import { v4 as uuid } from 'uuid';
import type { Timeline, Entry } from '../types';
import { ConflictError, type StorageAdapter } from './interface';
import { mergeDiskState } from './merge';

const SAVE_ID_FILE = 'saveId';

// ----- low-level OPFS helpers -----

async function getRoot(): Promise<FileSystemDirectoryHandle> {
  return navigator.storage.getDirectory();
}

async function dirPath(
  root: FileSystemDirectoryHandle,
  parts: string[],
  create: boolean,
): Promise<FileSystemDirectoryHandle> {
  let d = root;
  for (const p of parts) d = await d.getDirectoryHandle(p, { create });
  return d;
}

async function writeRaw(dir: FileSystemDirectoryHandle, name: string, data: string | ArrayBuffer): Promise<void> {
  const fh = await dir.getFileHandle(name, { create: true });
  const w = await fh.createWritable();
  await w.write(data);
  await w.close();
}

async function readText(dir: FileSystemDirectoryHandle, name: string): Promise<string> {
  const f = await (await dir.getFileHandle(name)).getFile();
  return f.text();
}

async function removeFile(dir: FileSystemDirectoryHandle, name: string): Promise<void> {
  try { await dir.removeEntry(name); } catch { /* already gone */ }
}

// Move a corrupt/unparseable file out of the active tree into `quarantine/` so
// it can never wedge a later JSON.parse. Best-effort: the file is copied under a
// unique, timestamped name and then removed from its original location. If the
// copy fails we still remove the original — a readable-but-invalid file must not
// stay where scanWorkspace will keep re-reading it.
async function quarantineFile(
  root: FileSystemDirectoryHandle,
  srcDir: FileSystemDirectoryHandle,
  name: string,
  label: string,
): Promise<void> {
  try {
    const text = await readText(srcDir, name);
    const qDir = await dirPath(root, ['quarantine'], true);
    await writeRaw(qDir, `${Date.now()}-${label}-${name}`, text);
  } catch { /* best-effort copy; still remove the original below */ }
  await removeFile(srcDir, name);
}

// ----- save-id helpers -----

async function readSaveId(root: FileSystemDirectoryHandle): Promise<string | undefined> {
  try {
    const meta = await dirPath(root, ['meta'], false);
    return await readText(meta, SAVE_ID_FILE);
  } catch {
    return undefined;
  }
}

async function writeSaveId(root: FileSystemDirectoryHandle, id: string): Promise<void> {
  const meta = await dirPath(root, ['meta'], true);
  await writeRaw(meta, SAVE_ID_FILE, id);
}

// ----- In-memory index for a workspace -----

interface FileMeta {
  timelines: Map<string, string>;  // timelineId → serialized JSON
  entries: Map<string, string>;    // entryId → serialized JSON
  quarantined: number;             // count of corrupt files moved aside
}

async function scanWorkspace(root: FileSystemDirectoryHandle): Promise<FileMeta> {
  const timelines = new Map<string, string>();
  const entries = new Map<string, string>();
  let quarantined = 0;

  let tlRoot: FileSystemDirectoryHandle;
  try {
    tlRoot = await root.getDirectoryHandle('timelines');
  } catch {
    return { timelines, entries, quarantined };
  }

  for await (const [tid, th] of tlRoot.entries()) {
    if (th.kind !== 'directory') continue;
    const tlDir = th as FileSystemDirectoryHandle;
    try {
      const text = await readText(tlDir, 'timeline.json');
      // Validate at scan time: a corrupt timeline.json is quarantined rather
      // than indexed, so downstream JSON.parse never throws.
      try {
        JSON.parse(text);
        timelines.set(tid, text);
      } catch {
        await quarantineFile(root, tlDir, 'timeline.json', `timeline-${tid}`);
        quarantined++;
      }
    } catch { /* no timeline.json */ }

    let eDir: FileSystemDirectoryHandle;
    try {
      eDir = await tlDir.getDirectoryHandle('entries');
    } catch { continue; }

    // Snapshot names first: quarantining mutates the directory as we go.
    const entryFiles: string[] = [];
    for await (const [fn, eh] of eDir.entries()) {
      if (eh.kind !== 'file' || !fn.endsWith('.json')) continue;
      entryFiles.push(fn);
    }
    for (const fn of entryFiles) {
      let text: string;
      try {
        text = await readText(eDir, fn);
      } catch { continue; /* unreadable entry */ }
      // Validate at scan time: a corrupt entry file is quarantined, not indexed.
      try {
        JSON.parse(text);
        entries.set(fn.slice(0, -5), text);
      } catch {
        await quarantineFile(root, eDir, fn, 'entry');
        quarantined++;
      }
    }
  }

  if (quarantined > 0) {
    console.warn(`[opfs] quarantined ${quarantined} corrupt file(s) into quarantine/`);
  }

  return { timelines, entries, quarantined };
}

// ----- Write helpers -----

async function writeTimelineFile(root: FileSystemDirectoryHandle, t: Timeline): Promise<void> {
  const dir = await dirPath(root, ['timelines', t.id], true);
  await writeRaw(dir, 'timeline.json', JSON.stringify(t, null, 2));
}

async function writeEntryFile(root: FileSystemDirectoryHandle, e: Entry): Promise<void> {
  const dir = await dirPath(root, ['timelines', e.timelineId, 'entries'], true);
  await writeRaw(dir, `${e.id}.json`, JSON.stringify(e, null, 2));
}

// ----- OpfsAdapter -----

export class OpfsAdapter implements StorageAdapter {
  private root: FileSystemDirectoryHandle | null = null;
  private lastKnownSaveId: string | undefined;
  private initialized = false;
  private frozen = false;

  // In-memory index — populated on load, kept in sync with writes.
  private timelines = new Map<string, string>();
  private entries = new Map<string, string>();

  private async init(): Promise<void> {
    if (this.initialized) return;
    this.root = await getRoot();
    this.lastKnownSaveId = await readSaveId(this.root);

    // Scan existing data into the in-memory index.
    const scan = await scanWorkspace(this.root);
    this.timelines = scan.timelines;
    this.entries = scan.entries;

    this.initialized = true;
  }

  private async getRootEnsured(): Promise<FileSystemDirectoryHandle> {
    await this.init();
    return this.root!;
  }

  async hasConflict(): Promise<boolean> {
    if (this.frozen) return true;
    await this.init();
    if (this.lastKnownSaveId === undefined) return false;
    const onDisk = await readSaveId(this.root!);
    if (onDisk !== undefined && onDisk !== this.lastKnownSaveId) {
      this.frozen = true;
      return true;
    }
    return false;
  }

  async mergeFromDisk(activeBase: Entry | null): Promise<{ duplicatedEntryId: string | null; importedCount: number }> {
    await this.init();
    this.frozen = false;

    // Re-scan the full workspace from OPFS.
    const scan = await scanWorkspace(this.root!);

    const diskTimelines: Timeline[] = [];
    const diskEntries: Entry[] = [];
    for (const text of scan.timelines.values()) diskTimelines.push(JSON.parse(text));
    for (const text of scan.entries.values()) diskEntries.push(JSON.parse(text));

    const outcome = mergeDiskState(diskTimelines, diskEntries, activeBase);

    // Update the in-memory index to match the merged state.
    this.timelines = new Map<string, string>();
    for (const t of outcome.timelines) {
      this.timelines.set(t.id, JSON.stringify(t, null, 2));
    }
    this.entries = new Map<string, string>();
    for (const e of outcome.entries) {
      this.entries.set(e.id, JSON.stringify(e, null, 2));
    }

    // Persist the merged state: write the duplicate and activeBase if needed.
    if (outcome.duplicatedEntryId && activeBase) {
      const dup = outcome.entries.find((e) => e.id === outcome.duplicatedEntryId)!;
      await writeEntryFile(this.root!, dup);
      await writeEntryFile(this.root!, activeBase);
    }

    // Bump saveId.
    const next = uuid();
    await writeSaveId(this.root!, next);
    this.lastKnownSaveId = next;

    return { duplicatedEntryId: outcome.duplicatedEntryId, importedCount: outcome.entries.length - this.entries.size };
  }

  async mergeConflictFiles(): Promise<{ importedCount: number; conflictCount: number }> {
    // OPFS is a private sandbox — no external sync tools can drop conflict files.
    return { importedCount: 0, conflictCount: 0 };
  }

  private async guardedWrite(op: () => Promise<void>): Promise<void> {
    if (await this.hasConflict()) throw new ConflictError();
    await op();
    const next = uuid();
    await writeSaveId(this.root!, next);
    this.lastKnownSaveId = next;
  }

  // ----- Timelines -----

  async getAllTimelines(): Promise<Timeline[]> {
    await this.init();
    return [...this.timelines.values()].map((t) => JSON.parse(t));
  }

  async putTimeline(t: Timeline): Promise<void> {
    await this.guardedWrite(async () => {
      await writeTimelineFile(this.root!, t);
      this.timelines.set(t.id, JSON.stringify(t, null, 2));
    });
  }

  async deleteTimeline(id: string): Promise<void> {
    await this.guardedWrite(async () => {
      // Remove timeline folder recursively.
      try {
        const tlRoot = await this.root!.getDirectoryHandle('timelines');
        await tlRoot.removeEntry(id, { recursive: true });
      } catch { /* already gone */ }
      this.timelines.delete(id);
      // Remove all entries for this timeline from the index.
      for (const [eid, text] of this.entries) {
        const e = JSON.parse(text) as Entry;
        if (e.timelineId === id) this.entries.delete(eid);
      }
    });
  }

  // ----- Entries -----

  async getAllEntries(): Promise<Entry[]> {
    await this.init();
    return [...this.entries.values()].map((e) => JSON.parse(e));
  }

  async getEntriesForTimeline(timelineId: string): Promise<Entry[]> {
    await this.init();
    const result: Entry[] = [];
    for (const text of this.entries.values()) {
      const e = JSON.parse(text) as Entry;
      if (e.timelineId === timelineId) result.push(e);
    }
    return result;
  }

  async putEntry(e: Entry): Promise<void> {
    await this.guardedWrite(async () => {
      await writeEntryFile(this.root!, e);
      // If the entry changed timelines, remove the old entry file.
      const existing = this.entries.get(e.id);
      if (existing) {
        const parsed = JSON.parse(existing) as Entry;
        if (parsed.timelineId !== e.timelineId) {
          try {
            const oldDir = await dirPath(this.root!, ['timelines', parsed.timelineId, 'entries'], false);
            await removeFile(oldDir, `${e.id}.json`);
          } catch { /* already gone */ }
        }
      }
      this.entries.set(e.id, JSON.stringify(e, null, 2));
    });
  }

  async deleteEntry(id: string): Promise<void> {
    await this.guardedWrite(async () => {
      const text = this.entries.get(id);
      let timelineId: string | undefined;
      if (text) {
        timelineId = (JSON.parse(text) as Entry).timelineId;
      }
      this.entries.delete(id);
      if (timelineId) {
        try {
          const eDir = await dirPath(this.root!, ['timelines', timelineId, 'entries'], false);
          await removeFile(eDir, `${id}.json`);
        } catch { /* already gone */ }
      }
    });
  }

  async deleteEntriesForTimeline(timelineId: string): Promise<void> {
    await this.guardedWrite(async () => {
      for (const [eid, text] of this.entries) {
        const e = JSON.parse(text) as Entry;
        if (e.timelineId === timelineId) this.entries.delete(eid);
      }
      try {
        const tlDir = await dirPath(this.root!, ['timelines', timelineId], false);
        await tlDir.removeEntry('entries', { recursive: true });
      } catch { /* nothing to remove */ }
    });
  }

  // Wipe all user data: remove the `timelines/` and `blobs/` trees and empty the
  // in-memory index. `meta/` (the saveId marker) is preserved so guardedWrite's
  // conflict tracking keeps working across the wipe.
  async clearAll(): Promise<void> {
    await this.guardedWrite(async () => {
      const root = this.root!;
      try { await root.removeEntry('timelines', { recursive: true }); } catch { /* already gone */ }
      try { await root.removeEntry('blobs', { recursive: true }); } catch { /* already gone */ }
      this.timelines = new Map<string, string>();
      this.entries = new Map<string, string>();
    });
  }

  // ----- Blobs -----

  private async blobDir(): Promise<FileSystemDirectoryHandle> {
    return dirPath(await this.getRootEnsured(), ['blobs'], true);
  }

  async getBlob(key: string): Promise<ArrayBuffer | undefined> {
    try {
      const dir = await this.blobDir();
      const fh = await dir.getFileHandle(`${key}.bin`);
      return (await fh.getFile()).arrayBuffer();
    } catch { return undefined; }
  }

  async putBlob(key: string, data: ArrayBuffer): Promise<void> {
    await this.guardedWrite(async () => {
      const dir = await this.blobDir();
      await writeRaw(dir, `${key}.bin`, data);
    });
  }

  async deleteBlob(key: string): Promise<void> {
    await this.guardedWrite(async () => {
      const dir = await this.blobDir();
      await removeFile(dir, `${key}.bin`);
    });
  }

  async getAllBlobKeys(): Promise<string[]> {
    try {
      const dir = await this.blobDir();
      const keys: string[] = [];
      for await (const [name, h] of dir.entries()) {
        if (h.kind === 'file' && name.endsWith('.bin')) keys.push(name.slice(0, -4));
      }
      return keys;
    } catch { return []; }
  }

  async getAllBlobs(): Promise<Record<string, ArrayBuffer>> {
    try {
      const dir = await this.blobDir();
      const result: Record<string, ArrayBuffer> = {};
      for await (const [name, h] of dir.entries()) {
        if (h.kind === 'file' && name.endsWith('.bin')) {
          const file = await (h as FileSystemFileHandle).getFile();
          result[name.slice(0, -4)] = await file.arrayBuffer();
        }
      }
      return result;
    } catch { return {}; }
  }
}
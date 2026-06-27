import { v4 as uuid } from 'uuid';
import type { Timeline, Entry } from '../types';
import { ConflictError, type StorageAdapter } from './interface';
import { mergeDiskState, mergeForeignState } from './merge';

// Legacy single-file workspace format (everything in `<name>.json`). Only read
// during migration to the per-entry layout; never written anymore.
interface WorkspaceData {
  version: number;
  timelines: Timeline[];
  entries: Entry[];
  saveId?: string;
}

// What we last know about a file we have read or written, so a per-file change
// (another tab, or Syncthing pulling a remote edit) can be detected cheaply by
// mtime and confirmed exactly by content.
interface FileMeta { mtime: number; content: string }
interface EntryMeta extends FileMeta { timelineId: string }

// ----- low-level FSA helpers -----

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

async function readText(dir: FileSystemDirectoryHandle, name: string): Promise<{ text: string; mtime: number }> {
  const f = await (await dir.getFileHandle(name)).getFile();
  return { text: await f.text(), mtime: f.lastModified };
}

// Write a timeline's metadata file and return the serialized form + its on-disk
// mtime, so the caller can refresh its in-memory index.
async function writeTimelineFile(wsDir: FileSystemDirectoryHandle, t: Timeline): Promise<FileMeta> {
  const dir = await dirPath(wsDir, ['timelines', t.id], true);
  const content = JSON.stringify(t, null, 2);
  await writeRaw(dir, 'timeline.json', content);
  const mtime = (await (await dir.getFileHandle('timeline.json')).getFile()).lastModified;
  return { content, mtime };
}

async function writeEntryFile(wsDir: FileSystemDirectoryHandle, e: Entry): Promise<FileMeta> {
  const dir = await dirPath(wsDir, ['timelines', e.timelineId, 'entries'], true);
  const content = JSON.stringify(e, null, 2);
  await writeRaw(dir, `${e.id}.json`, content);
  const mtime = (await (await dir.getFileHandle(`${e.id}.json`)).getFile()).lastModified;
  return { content, mtime };
}

// Rename a file within its directory. Prefer the native move() (Chromium) but
// fall back to copy-bytes + remove when it is unavailable OR throws — move()
// exists but is disallowed on some user-picked directory handles.
async function renameTo(dir: FileSystemDirectoryHandle, name: string, target: string): Promise<void> {
  const fh = await dir.getFileHandle(name);
  const movable = fh as FileSystemFileHandle & { move?: (newName: string) => Promise<void> };
  if (typeof movable.move === 'function') {
    try {
      await movable.move(target);
      return;
    } catch { /* fall through to copy + remove */ }
  }
  const bytes = await (await fh.getFile()).arrayBuffer();
  await writeRaw(dir, target, bytes);
  await dir.removeEntry(name);
}

function renameToDone(dir: FileSystemDirectoryHandle, name: string): Promise<void> {
  return renameTo(dir, name, `${name}.done`);
}

// Read the legacy `<name>.json` single-file workspace, if present.
async function readLegacyFile(dir: FileSystemDirectoryHandle, name: string): Promise<WorkspaceData | null> {
  try {
    const fh = await dir.getFileHandle(`${name}.json`);
    const parsed = JSON.parse(await (await fh.getFile()).text()) as WorkspaceData;
    return { version: 2, timelines: parsed.timelines ?? [], entries: parsed.entries ?? [] };
  } catch {
    return null;
  }
}

// Convert a legacy `<name>.json` (+ `<name>/<key>.bin` blobs) into the per-entry
// folder layout under `<name>/`. The old blob subfolder *is* the new workspace
// folder, so loose `.bin` files at its top level are moved down into `blobs/`.
// The legacy file is archived as `<name>.json.migrated` (a free backup) rather
// than deleted, and excluded from listWorkspaces.
async function migrate(rootDir: FileSystemDirectoryHandle, wsDir: FileSystemDirectoryHandle, name: string): Promise<void> {
  const legacy = await readLegacyFile(rootDir, name);
  if (!legacy) return;
  await writeRaw(wsDir, 'workspace.json', JSON.stringify({ version: 3 }, null, 2));
  for (const t of legacy.timelines) await writeTimelineFile(wsDir, t);
  for (const e of legacy.entries) await writeEntryFile(wsDir, e);

  const binNames: string[] = [];
  for await (const [n, h] of wsDir.entries()) {
    if (h.kind === 'file' && n.endsWith('.bin')) binNames.push(n);
  }
  if (binNames.length) {
    const blobs = await wsDir.getDirectoryHandle('blobs', { create: true });
    for (const n of binNames) {
      const bytes = await (await (await wsDir.getFileHandle(n)).getFile()).arrayBuffer();
      await writeRaw(blobs, n, bytes);
      await wsDir.removeEntry(n);
    }
  }
  await renameTo(rootDir, `${name}.json`, `${name}.json.migrated`);
}

interface ScanResult {
  timelines: Timeline[];
  entries: Entry[];
  timelineMeta: Map<string, FileMeta>;
  entryMeta: Map<string, EntryMeta>;
}

// Read the whole workspace tree into memory plus a per-file index. Skips
// Syncthing conflict files — those are handled separately by mergeConflictFiles.
async function scanWorkspace(wsDir: FileSystemDirectoryHandle): Promise<ScanResult> {
  const timelines: Timeline[] = [];
  const entries: Entry[] = [];
  const timelineMeta = new Map<string, FileMeta>();
  const entryMeta = new Map<string, EntryMeta>();

  let tlRoot: FileSystemDirectoryHandle;
  try {
    tlRoot = await wsDir.getDirectoryHandle('timelines');
  } catch {
    return { timelines, entries, timelineMeta, entryMeta };
  }

  for await (const [, th] of tlRoot.entries()) {
    if (th.kind !== 'directory') continue;
    const tlDir = th as FileSystemDirectoryHandle;
    try {
      const { text, mtime } = await readText(tlDir, 'timeline.json');
      const t = JSON.parse(text) as Timeline;
      timelines.push(t);
      timelineMeta.set(t.id, { content: text, mtime });
    } catch { /* a folder without a (readable) timeline.json — skip metadata */ }

    let eDir: FileSystemDirectoryHandle;
    try {
      eDir = await tlDir.getDirectoryHandle('entries');
    } catch {
      continue;
    }
    for await (const [fn, eh] of eDir.entries()) {
      if (eh.kind !== 'file' || !fn.endsWith('.json') || fn.includes('.sync-conflict-')) continue;
      try {
        const { text, mtime } = await readText(eDir, fn);
        const e = JSON.parse(text) as Entry;
        entries.push(e);
        entryMeta.set(e.id, { timelineId: e.timelineId, content: text, mtime });
      } catch { /* unreadable/corrupt entry file — skip */ }
    }
  }
  return { timelines, entries, timelineMeta, entryMeta };
}

// Cheap listing-only scan: ids → mtimes, without reading file contents. Ids come
// from the folder/file names (timeline folder = id, entry file = `<id>.json`),
// which is exactly how we write them, so no parse is needed to detect change.
async function scanMtimes(wsDir: FileSystemDirectoryHandle): Promise<{ timelines: Map<string, number>; entries: Map<string, number> }> {
  const tl = new Map<string, number>();
  const en = new Map<string, number>();
  let tlRoot: FileSystemDirectoryHandle;
  try {
    tlRoot = await wsDir.getDirectoryHandle('timelines');
  } catch {
    return { timelines: tl, entries: en };
  }
  for await (const [tid, th] of tlRoot.entries()) {
    if (th.kind !== 'directory') continue;
    const tlDir = th as FileSystemDirectoryHandle;
    try {
      tl.set(tid, (await (await tlDir.getFileHandle('timeline.json')).getFile()).lastModified);
    } catch { /* no timeline.json */ }
    try {
      const eDir = await tlDir.getDirectoryHandle('entries');
      for await (const [fn, eh] of eDir.entries()) {
        if (eh.kind !== 'file' || !fn.endsWith('.json') || fn.includes('.sync-conflict-')) continue;
        en.set(fn.slice(0, -5), (await (eh as FileSystemFileHandle).getFile()).lastModified);
      }
    } catch { /* no entries folder */ }
  }
  return { timelines: tl, entries: en };
}

// List workspaces in a picked folder: new-format folders (those containing a
// `workspace.json` marker) plus any not-yet-migrated legacy `<name>.json` files,
// de-duplicated so a workspace mid-migration appears exactly once. Syncthing
// conflict files and archived `.migrated`/`.done` files are excluded.
export async function listWorkspaces(dir: FileSystemDirectoryHandle): Promise<string[]> {
  const names = new Set<string>();
  for await (const [name, handle] of dir.entries()) {
    if (handle.kind === 'file' && name.endsWith('.json') && !name.includes('.sync-conflict-')) {
      names.add(name.slice(0, -5));
    } else if (handle.kind === 'directory') {
      try {
        await (handle as FileSystemDirectoryHandle).getFileHandle('workspace.json');
        names.add(name);
      } catch { /* not a new-format workspace folder */ }
    }
  }
  return [...names].sort();
}

export class FileAdapter implements StorageAdapter {
  private timelines: Timeline[];
  private entries: Entry[];
  private timelineMeta: Map<string, FileMeta>;
  private entryMeta: Map<string, EntryMeta>;
  private readonly wsDir: FileSystemDirectoryHandle;
  readonly workspaceName: string;
  private markerEnsured: boolean;
  // Conflict files already merged this session, keyed by full path. Guards against
  // re-merging (and re-duplicating) the same file every poll tick if renaming it
  // to `.done` fails.
  private readonly mergedConflicts = new Set<string>();

  private constructor(wsDir: FileSystemDirectoryHandle, name: string, scan: ScanResult, markerEnsured: boolean) {
    this.wsDir = wsDir;
    this.workspaceName = name;
    this.timelines = scan.timelines;
    this.entries = scan.entries;
    this.timelineMeta = scan.timelineMeta;
    this.entryMeta = scan.entryMeta;
    this.markerEnsured = markerEnsured;
  }

  static async load(rootDir: FileSystemDirectoryHandle, name: string): Promise<FileAdapter> {
    const wsDir = await rootDir.getDirectoryHandle(name, { create: true });
    let markerExists = true;
    try {
      await wsDir.getFileHandle('workspace.json');
    } catch {
      markerExists = false;
    }
    if (!markerExists) {
      let legacyExists = true;
      try {
        await rootDir.getFileHandle(`${name}.json`);
      } catch {
        legacyExists = false;
      }
      if (legacyExists) {
        await migrate(rootDir, wsDir, name);
        markerExists = true;
      }
    }
    const scan = await scanWorkspace(wsDir);
    return new FileAdapter(wsDir, name, scan, markerExists);
  }

  private async ensureMarker(): Promise<void> {
    if (this.markerEnsured) return;
    await writeRaw(this.wsDir, 'workspace.json', JSON.stringify({ version: 3 }, null, 2));
    this.markerEnsured = true;
  }

  private async writeTimeline(t: Timeline): Promise<void> {
    const meta = await writeTimelineFile(this.wsDir, t);
    this.timelineMeta.set(t.id, meta);
  }

  private async writeEntry(e: Entry): Promise<void> {
    const meta = await writeEntryFile(this.wsDir, e);
    this.entryMeta.set(e.id, { timelineId: e.timelineId, ...meta });
  }

  private async removeEntryFile(timelineId: string, id: string): Promise<void> {
    try {
      const eDir = await dirPath(this.wsDir, ['timelines', timelineId, 'entries'], false);
      await eDir.removeEntry(`${id}.json`);
    } catch { /* already gone */ }
    this.entryMeta.delete(id);
  }

  // Returns true if any timeline/entry file on disk is new, deleted, or has a
  // different mtime than we last recorded — i.e. another tab or Syncthing changed
  // the tree. Confirmation by content happens in mergeFromDisk.
  async hasConflict(): Promise<boolean> {
    const disk = await scanMtimes(this.wsDir);
    for (const [id, mtime] of disk.timelines) {
      const known = this.timelineMeta.get(id);
      if (!known || known.mtime !== mtime) return true;
    }
    for (const id of this.timelineMeta.keys()) {
      if (!disk.timelines.has(id)) return true;
    }
    for (const [id, mtime] of disk.entries) {
      const known = this.entryMeta.get(id);
      if (!known || known.mtime !== mtime) return true;
    }
    for (const id of this.entryMeta.keys()) {
      if (!disk.entries.has(id)) return true;
    }
    return false;
  }

  // Adopt the on-disk state after another instance (or Syncthing) changed it. The
  // one local change that may not be on disk is a note open in the editor
  // (activeBase); if its disk version diverged, the editor's copy is kept under
  // its id and the disk version preserved as a marked duplicate.
  async mergeFromDisk(activeBase: Entry | null): Promise<{ duplicatedEntryId: string | null; importedCount: number }> {
    const scan = await scanWorkspace(this.wsDir);
    const before = new Set(this.entries.map((e) => e.id));
    const outcome = mergeDiskState(scan.timelines, scan.entries, activeBase);
    const importedCount = outcome.entries.filter((e) => !before.has(e.id)).length;
    this.timelines = outcome.timelines;
    this.entries = outcome.entries;
    this.timelineMeta = scan.timelineMeta;
    this.entryMeta = scan.entryMeta;
    if (outcome.duplicatedEntryId) {
      const dup = outcome.entries.find((e) => e.id === outcome.duplicatedEntryId)!;
      await this.writeEntry(dup);
      if (activeBase) await this.writeEntry(activeBase);
    }
    return { duplicatedEntryId: outcome.duplicatedEntryId, importedCount };
  }

  // Scan the workspace tree for Syncthing conflict files and merge them in. Each
  // entry conflict lives at `timelines/<tid>/entries/<id>.sync-conflict-*.json`,
  // a timeline-metadata conflict at `timelines/<tid>/timeline.sync-conflict-*.json`,
  // and the rare blob conflict at `blobs/<key>.sync-conflict-*.bin`. Each merged
  // file is renamed `.done` so it isn't processed again.
  async mergeConflictFiles(): Promise<{ importedCount: number; conflictCount: number }> {
    let importedCount = 0;
    let conflictCount = 0;
    const prevTimelines = [...this.timelines];
    const prevEntries = [...this.entries];
    // Files to mark `.done` only AFTER a successful persist, so a failed write
    // leaves the conflict files in place to be retried on the next poll tick.
    const processed: Array<{ dir: FileSystemDirectoryHandle; name: string; key: string }> = [];

    let tlRoot: FileSystemDirectoryHandle | null = null;
    try { tlRoot = await this.wsDir.getDirectoryHandle('timelines'); } catch { /* no timelines yet */ }
    if (tlRoot) {
      const tlDirs: Array<[string, FileSystemDirectoryHandle]> = [];
      for await (const [tid, th] of tlRoot.entries()) {
        if (th.kind === 'directory') tlDirs.push([tid, th as FileSystemDirectoryHandle]);
      }
      for (const [tid, tlDir] of tlDirs) {
        // Timeline-metadata conflicts.
        const tlConflicts: string[] = [];
        for await (const [n, h] of tlDir.entries()) {
          if (h.kind === 'file' && n.startsWith('timeline') && n.includes('.sync-conflict-') && n.endsWith('.json')
            && !this.mergedConflicts.has(`${tid}/${n}`)) {
            tlConflicts.push(n);
          }
        }
        for (const n of tlConflicts) {
          try {
            const parsed = JSON.parse(await (await (await tlDir.getFileHandle(n)).getFile()).text()) as Timeline;
            const outcome = mergeForeignState(this.timelines, this.entries, [parsed], []);
            this.timelines = outcome.timelines;
            this.entries = outcome.entries;
            importedCount += outcome.importedCount;
            conflictCount += outcome.conflictCount;
            processed.push({ dir: tlDir, name: n, key: `${tid}/${n}` });
          } catch { /* unreadable — leave for the user */ }
        }

        // Entry conflicts.
        let eDir: FileSystemDirectoryHandle | null = null;
        try { eDir = await tlDir.getDirectoryHandle('entries'); } catch { /* none */ }
        if (eDir) {
          const eConflicts: string[] = [];
          for await (const [n, h] of eDir.entries()) {
            if (h.kind === 'file' && n.includes('.sync-conflict-') && n.endsWith('.json')
              && !this.mergedConflicts.has(`${tid}/entries/${n}`)) {
              eConflicts.push(n);
            }
          }
          for (const n of eConflicts) {
            try {
              const parsed = JSON.parse(await (await (await eDir.getFileHandle(n)).getFile()).text()) as Entry;
              const outcome = mergeForeignState(this.timelines, this.entries, [], [parsed]);
              this.timelines = outcome.timelines;
              this.entries = outcome.entries;
              importedCount += outcome.importedCount;
              conflictCount += outcome.conflictCount;
              processed.push({ dir: eDir, name: n, key: `${tid}/entries/${n}` });
            } catch { /* unreadable — leave for the user */ }
          }
        }
      }
    }

    // Defensive: blob conflict files. Blob keys are unique per attachment, so two
    // attachments practically never collide — but if one does, preserve both by
    // re-keying the conflicted bytes and attaching them as a second attachment.
    let blobDir: FileSystemDirectoryHandle | null = null;
    try { blobDir = await this.wsDir.getDirectoryHandle('blobs'); } catch { /* no blobs yet */ }
    if (blobDir) {
      const blobConflicts: string[] = [];
      for await (const [n, h] of blobDir.entries()) {
        if (h.kind === 'file' && n.includes('.sync-conflict-') && n.endsWith('.bin')
          && !this.mergedConflicts.has(`blobs/${n}`)) {
          blobConflicts.push(n);
        }
      }
      for (const n of blobConflicts) {
        const origKey = n.slice(0, n.indexOf('.sync-conflict-'));
        try {
          const referencing = this.entries.filter((e) => e.attachments.some((a) => a.blobKey === origKey));
          if (referencing.length > 0) {
            const bytes = await (await (await blobDir.getFileHandle(n)).getFile()).arrayBuffer();
            const newKey = `blob-${uuid()}`;
            await writeRaw(blobDir, `${newKey}.bin`, bytes);
            for (const e of referencing) {
              const ref = e.attachments.find((a) => a.blobKey === origKey)!;
              const updated: Entry = {
                ...e,
                attachments: [...e.attachments, { ...ref, id: uuid(), name: `${ref.name} (conflicted copy)`, blobKey: newKey }],
              };
              const i = this.entries.findIndex((x) => x.id === e.id);
              this.entries[i] = updated;
            }
          }
          processed.push({ dir: blobDir, name: n, key: `blobs/${n}` });
        } catch { /* unreadable — leave for the user */ }
      }
    }

    if (processed.length > 0) await this.syncToDisk(prevTimelines, prevEntries);
    // Only reached when the persist (if any) succeeded, so the merged data is
    // safe. Mark each file merged first so a rename failure can't cause it to be
    // merged (and duplicated) again on the next poll tick.
    for (const { dir, name, key } of processed) {
      this.mergedConflicts.add(key);
      try {
        await renameToDone(dir, name);
      } catch (e) {
        console.warn(`Merged conflict file "${name}" but could not rename it to .done:`, e);
      }
    }
    return { importedCount, conflictCount };
  }

  // Write out only the timelines/entries that differ from a prior snapshot (and
  // remove ones that disappeared). Used to persist the results of a merge without
  // rewriting the whole tree.
  private async syncToDisk(prevTimelines: Timeline[], prevEntries: Entry[]): Promise<void> {
    const prevT = new Map(prevTimelines.map((t) => [t.id, JSON.stringify(t, null, 2)]));
    const prevE = new Map(prevEntries.map((e) => [e.id, JSON.stringify(e, null, 2)]));
    for (const t of this.timelines) {
      if (prevT.get(t.id) !== JSON.stringify(t, null, 2)) await this.writeTimeline(t);
    }
    for (const e of this.entries) {
      if (prevE.get(e.id) !== JSON.stringify(e, null, 2)) await this.writeEntry(e);
    }
    const curT = new Set(this.timelines.map((t) => t.id));
    for (const t of prevTimelines) {
      if (!curT.has(t.id)) await this.removeTimelineFolder(t.id);
    }
    const curE = new Set(this.entries.map((e) => e.id));
    for (const e of prevEntries) {
      if (!curE.has(e.id)) await this.removeEntryFile(e.timelineId, e.id);
    }
  }

  // Re-persist all in-memory state. Used after re-granting folder permission.
  async persistAll(): Promise<void> {
    await this.ensureMarker();
    for (const t of this.timelines) await this.writeTimeline(t);
    for (const e of this.entries) await this.writeEntry(e);
  }

  // Timelines
  async getAllTimelines(): Promise<Timeline[]> { return [...this.timelines]; }

  async putTimeline(t: Timeline): Promise<void> {
    await this.ensureMarker();
    const prev = this.timelineMeta.get(t.id);
    if (prev) {
      let diskText: string | undefined;
      try { diskText = (await readText(await dirPath(this.wsDir, ['timelines', t.id], false), 'timeline.json')).text; }
      catch { diskText = undefined; }
      if (diskText === undefined || diskText !== prev.content) throw new ConflictError();
    }
    const i = this.timelines.findIndex((x) => x.id === t.id);
    if (i >= 0) this.timelines[i] = t; else this.timelines.push(t);
    await this.writeTimeline(t);
  }

  async deleteTimeline(id: string): Promise<void> {
    this.timelines = this.timelines.filter((t) => t.id !== id);
    // Removing the folder also removes the timeline's entry files, so drop those
    // from memory and the index to stay consistent.
    this.entries = this.entries.filter((e) => e.timelineId !== id);
    for (const [eid, m] of this.entryMeta) {
      if (m.timelineId === id) this.entryMeta.delete(eid);
    }
    await this.removeTimelineFolder(id);
  }

  private async removeTimelineFolder(id: string): Promise<void> {
    this.timelineMeta.delete(id);
    try {
      const tlRoot = await this.wsDir.getDirectoryHandle('timelines');
      await tlRoot.removeEntry(id, { recursive: true });
    } catch { /* already gone */ }
  }

  // Entries
  async getAllEntries(): Promise<Entry[]> { return [...this.entries]; }

  async getEntriesForTimeline(timelineId: string): Promise<Entry[]> {
    return this.entries.filter((e) => e.timelineId === timelineId);
  }

  async putEntry(e: Entry): Promise<void> {
    await this.ensureMarker();
    const prev = this.entryMeta.get(e.id);
    if (prev) {
      let diskText: string | undefined;
      try { diskText = (await readText(await dirPath(this.wsDir, ['timelines', prev.timelineId, 'entries'], false), `${e.id}.json`)).text; }
      catch { diskText = undefined; }
      if (diskText === undefined || diskText !== prev.content) throw new ConflictError();
    }
    const i = this.entries.findIndex((x) => x.id === e.id);
    if (i >= 0) this.entries[i] = e; else this.entries.push(e);
    if (prev && prev.timelineId !== e.timelineId) await this.removeEntryFile(prev.timelineId, e.id);
    await this.writeEntry(e);
  }

  async deleteEntry(id: string): Promise<void> {
    const timelineId = this.entryMeta.get(id)?.timelineId ?? this.entries.find((e) => e.id === id)?.timelineId;
    this.entries = this.entries.filter((e) => e.id !== id);
    if (timelineId) await this.removeEntryFile(timelineId, id);
  }

  async deleteEntriesForTimeline(timelineId: string): Promise<void> {
    const ids = this.entries.filter((e) => e.timelineId === timelineId).map((e) => e.id);
    this.entries = this.entries.filter((e) => e.timelineId !== timelineId);
    try {
      const tlDir = await dirPath(this.wsDir, ['timelines', timelineId], false);
      await tlDir.removeEntry('entries', { recursive: true });
    } catch { /* nothing to remove */ }
    for (const id of ids) this.entryMeta.delete(id);
  }

  // Blobs
  private async blobDir(): Promise<FileSystemDirectoryHandle> {
    return this.wsDir.getDirectoryHandle('blobs', { create: true });
  }

  async getBlob(key: string): Promise<ArrayBuffer | undefined> {
    try {
      const dir = await this.blobDir();
      const fh = await dir.getFileHandle(`${key}.bin`);
      return (await fh.getFile()).arrayBuffer();
    } catch { return undefined; }
  }

  async putBlob(key: string, data: ArrayBuffer): Promise<void> {
    await this.ensureMarker();
    const dir = await this.blobDir();
    await writeRaw(dir, `${key}.bin`, data);
  }

  async deleteBlob(key: string): Promise<void> {
    try {
      const dir = await this.blobDir();
      await dir.removeEntry(`${key}.bin`);
    } catch { /* already gone */ }
  }

  async getAllBlobKeys(): Promise<string[]> {
    try {
      const dir = await this.blobDir();
      const keys: string[] = [];
      for await (const [name, h] of dir.entries()) {
        if (h.kind === 'file' && name.endsWith('.bin') && !name.includes('.sync-conflict-')) keys.push(name.slice(0, -4));
      }
      return keys;
    } catch { return []; }
  }

  async getAllBlobs(): Promise<Record<string, ArrayBuffer>> {
    try {
      const dir = await this.blobDir();
      const result: Record<string, ArrayBuffer> = {};
      for await (const [name, h] of dir.entries()) {
        if (h.kind === 'file' && name.endsWith('.bin') && !name.includes('.sync-conflict-')) {
          const file = await (h as FileSystemFileHandle).getFile();
          result[name.slice(0, -4)] = await file.arrayBuffer();
        }
      }
      return result;
    } catch { return {}; }
  }
}

import { v4 as uuid } from 'uuid';
import type { Timeline, Entry } from '../types';
import { ConflictError, type StorageAdapter } from './interface';
import { mergeDiskState, mergeForeignState } from './merge';

interface WorkspaceData {
  version: number;
  timelines: Timeline[];
  entries: Entry[];
  saveId?: string;
}

async function readWorkspaceFile(dir: FileSystemDirectoryHandle, name: string): Promise<WorkspaceData> {
  try {
    const fh = await dir.getFileHandle(`${name}.json`);
    const parsed = JSON.parse(await (await fh.getFile()).text()) as WorkspaceData;
    return {
      version: 2,
      timelines: parsed.timelines ?? [],
      entries: parsed.entries ?? [],
      saveId: parsed.saveId,
    };
  } catch {
    return { version: 2, timelines: [], entries: [] };
  }
}

export async function listWorkspaces(dir: FileSystemDirectoryHandle): Promise<string[]> {
  const names: string[] = [];
  for await (const [name, handle] of dir.entries()) {
    // Skip Syncthing conflict files (`<ws>.sync-conflict-*.json`) and processed
    // ones (`*.done`) so they never show up as selectable workspaces.
    if (handle.kind === 'file' && name.endsWith('.json') && !name.includes('.sync-conflict-')) {
      names.push(name.slice(0, -5));
    }
  }
  return names.sort();
}

// Rename a file to `<name>.done` within its directory. Prefer the native move()
// (Chromium) but fall back to copy-bytes + remove when it is unavailable OR
// throws — move() exists but is disallowed on some user-picked directory handles.
async function renameToDone(dir: FileSystemDirectoryHandle, name: string): Promise<void> {
  const fh = await dir.getFileHandle(name);
  const target = `${name}.done`;
  const movable = fh as FileSystemFileHandle & { move?: (newName: string) => Promise<void> };
  if (typeof movable.move === 'function') {
    try {
      await movable.move(target);
      return;
    } catch { /* fall through to copy + remove */ }
  }
  const bytes = await (await fh.getFile()).arrayBuffer();
  const out = await dir.getFileHandle(target, { create: true });
  const w = await out.createWritable();
  await w.write(bytes);
  await w.close();
  await dir.removeEntry(name);
}

export class FileAdapter implements StorageAdapter {
  private timelines: Timeline[];
  private entries: Entry[];
  private readonly dir: FileSystemDirectoryHandle;
  readonly workspaceName: string;
  private lastKnownSaveId: string | undefined;
  private frozen = false;
  // Conflict files already merged this session. Guards against re-merging (and
  // re-duplicating) the same file every poll tick if renaming it to `.done` fails.
  private readonly mergedConflicts = new Set<string>();

  private constructor(dir: FileSystemDirectoryHandle, workspaceName: string, data: WorkspaceData) {
    this.dir = dir;
    this.workspaceName = workspaceName;
    this.timelines = data.timelines;
    this.entries = data.entries;
    this.lastKnownSaveId = data.saveId;
  }

  static async load(dir: FileSystemDirectoryHandle, name: string): Promise<FileAdapter> {
    const data = await readWorkspaceFile(dir, name);
    return new FileAdapter(dir, name, data);
  }

  private async readDisk(): Promise<WorkspaceData> {
    return readWorkspaceFile(this.dir, this.workspaceName);
  }

  // Returns true if another tab has written a different saveId. Latches the
  // adapter into a frozen state once tripped so further flushes are blocked.
  async hasConflict(): Promise<boolean> {
    if (this.frozen) return true;
    if (this.lastKnownSaveId === undefined) return false;
    const onDisk = (await this.readDisk()).saveId;
    if (onDisk !== undefined && onDisk !== this.lastKnownSaveId) {
      this.frozen = true;
      return true;
    }
    return false;
  }

  // Recover from a detected conflict: adopt the other instance's saved state and
  // unfreeze. If a note open in the editor (activeBase) also changed on disk, the
  // disk version is kept as a marked duplicate so neither edit is lost.
  async mergeFromDisk(activeBase: Entry | null): Promise<{ duplicatedEntryId: string | null; importedCount: number }> {
    const disk = await this.readDisk();
    const before = new Set(this.entries.map((e) => e.id));
    const outcome = mergeDiskState(disk.timelines, disk.entries, activeBase);
    const importedCount = outcome.entries.filter((e) => !before.has(e.id)).length;
    this.timelines = outcome.timelines;
    this.entries = outcome.entries;
    this.frozen = false;
    this.lastKnownSaveId = disk.saveId;
    // Only persist when we actually changed the merged set (a preserved duplicate);
    // otherwise we've simply adopted disk in memory and leave the file untouched.
    if (outcome.duplicatedEntryId) await this.flush();
    return { duplicatedEntryId: outcome.duplicatedEntryId, importedCount };
  }

  // Scan the workspace folder for Syncthing conflict files and merge them in.
  // Note/timeline conflicts live in `<ws>.sync-conflict-*.json`; the rare blob
  // conflict lives in the `<ws>/` subfolder as `<key>.sync-conflict-*.bin`.
  // Each processed file is renamed `.done` so it isn't merged again.
  async mergeConflictFiles(): Promise<{ importedCount: number; conflictCount: number }> {
    let importedCount = 0;
    let conflictCount = 0;
    let changed = false;
    // Files to mark `.done` only AFTER a successful flush, so a failed flush
    // leaves the conflict files in place to be retried on the next poll tick.
    const processed: Array<{ dir: FileSystemDirectoryHandle; name: string }> = [];

    const jsonConflicts: string[] = [];
    for await (const [name, handle] of this.dir.entries()) {
      if (handle.kind === 'file'
        && name.startsWith(`${this.workspaceName}.sync-conflict-`)
        && name.endsWith('.json')
        && !this.mergedConflicts.has(name)) {
        jsonConflicts.push(name);
      }
    }
    for (const name of jsonConflicts) {
      let incoming: WorkspaceData;
      try {
        const fh = await this.dir.getFileHandle(name);
        const parsed = JSON.parse(await (await fh.getFile()).text()) as WorkspaceData;
        incoming = { version: 2, timelines: parsed.timelines ?? [], entries: parsed.entries ?? [] };
      } catch {
        continue; // unreadable/corrupt — leave it for the user to resolve
      }
      const outcome = mergeForeignState(this.timelines, this.entries, incoming.timelines, incoming.entries);
      this.timelines = outcome.timelines;
      this.entries = outcome.entries;
      importedCount += outcome.importedCount;
      conflictCount += outcome.conflictCount;
      changed = true;
      processed.push({ dir: this.dir, name });
    }

    // Defensive: blob conflict files. Blob keys are unique per attachment, so two
    // attachments practically never collide — but if one does, preserve both by
    // re-keying the conflicted bytes and attaching them as a second attachment.
    let subdir: FileSystemDirectoryHandle | null = null;
    try { subdir = await this.dir.getDirectoryHandle(this.workspaceName); } catch { /* no blob subfolder yet */ }
    if (subdir) {
      const blobConflicts: string[] = [];
      for await (const [name, handle] of subdir.entries()) {
        if (handle.kind === 'file' && name.includes('.sync-conflict-') && name.endsWith('.bin')
          && !this.mergedConflicts.has(name)) {
          blobConflicts.push(name);
        }
      }
      for (const name of blobConflicts) {
        const origKey = name.slice(0, name.indexOf('.sync-conflict-'));
        try {
          const referencing = this.entries.filter((e) => e.attachments.some((a) => a.blobKey === origKey));
          // Only preserve the conflicting bytes as a new attachment when some note
          // actually references the original blob; otherwise just clean it up.
          if (referencing.length > 0) {
            const bytes = await (await (await subdir.getFileHandle(name)).getFile()).arrayBuffer();
            const newKey = `blob-${uuid()}`;
            const out = await subdir.getFileHandle(`${newKey}.bin`, { create: true });
            const w = await out.createWritable();
            await w.write(bytes);
            await w.close();
            for (const e of referencing) {
              const ref = e.attachments.find((a) => a.blobKey === origKey)!;
              e.attachments = [...e.attachments, { ...ref, id: uuid(), name: `${ref.name} (conflicted copy)`, blobKey: newKey }];
            }
            changed = true;
          }
          processed.push({ dir: subdir, name });
        } catch {
          continue;
        }
      }
    }

    if (changed) await this.flush();
    // Only reached when the flush (if any) succeeded, so the merged data is safe.
    // Mark each file merged first so a rename failure can't cause it to be merged
    // (and duplicated) again on the next poll tick.
    for (const { dir, name } of processed) {
      this.mergedConflicts.add(name);
      try {
        await renameToDone(dir, name);
      } catch (e) {
        console.warn(`Merged conflict file "${name}" but could not rename it to .done:`, e);
      }
    }
    return { importedCount, conflictCount };
  }

  async flush(): Promise<void> {
    if (await this.hasConflict()) throw new ConflictError();
    const newSaveId = uuid();
    const data: WorkspaceData = {
      version: 2,
      timelines: this.timelines,
      entries: this.entries,
      saveId: newSaveId,
    };
    const fh = await this.dir.getFileHandle(`${this.workspaceName}.json`, { create: true });
    const w = await fh.createWritable();
    await w.write(JSON.stringify(data, null, 2));
    await w.close();
    this.lastKnownSaveId = newSaveId;
  }

  private async blobDir(): Promise<FileSystemDirectoryHandle> {
    return this.dir.getDirectoryHandle(this.workspaceName, { create: true });
  }

  // Timelines
  async getAllTimelines(): Promise<Timeline[]> { return [...this.timelines]; }

  async putTimeline(t: Timeline): Promise<void> {
    const i = this.timelines.findIndex(x => x.id === t.id);
    if (i >= 0) this.timelines[i] = t; else this.timelines.push(t);
    await this.flush();
  }

  async deleteTimeline(id: string): Promise<void> {
    this.timelines = this.timelines.filter(t => t.id !== id);
    await this.flush();
  }

  // Entries
  async getAllEntries(): Promise<Entry[]> { return [...this.entries]; }

  async getEntriesForTimeline(timelineId: string): Promise<Entry[]> {
    return this.entries.filter(e => e.timelineId === timelineId);
  }

  async putEntry(e: Entry): Promise<void> {
    const i = this.entries.findIndex(x => x.id === e.id);
    if (i >= 0) this.entries[i] = e; else this.entries.push(e);
    await this.flush();
  }

  async deleteEntry(id: string): Promise<void> {
    this.entries = this.entries.filter(e => e.id !== id);
    await this.flush();
  }

  async deleteEntriesForTimeline(timelineId: string): Promise<void> {
    this.entries = this.entries.filter(e => e.timelineId !== timelineId);
    await this.flush();
  }

  // Blobs
  async getBlob(key: string): Promise<ArrayBuffer | undefined> {
    try {
      const dir = await this.blobDir();
      const fh = await dir.getFileHandle(`${key}.bin`);
      return (await fh.getFile()).arrayBuffer();
    } catch { return undefined; }
  }

  async putBlob(key: string, data: ArrayBuffer): Promise<void> {
    const dir = await this.blobDir();
    const fh = await dir.getFileHandle(`${key}.bin`, { create: true });
    const w = await fh.createWritable();
    await w.write(data);
    await w.close();
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

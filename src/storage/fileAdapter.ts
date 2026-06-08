import { v4 as uuid } from 'uuid';
import type { Timeline, Entry } from '../types';
import { ConflictError, type StorageAdapter } from './interface';
import { mergeDiskState } from './merge';

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
    if (handle.kind === 'file' && name.endsWith('.json')) {
      names.push(name.slice(0, -5));
    }
  }
  return names.sort();
}

export class FileAdapter implements StorageAdapter {
  private timelines: Timeline[];
  private entries: Entry[];
  private readonly dir: FileSystemDirectoryHandle;
  readonly workspaceName: string;
  private lastKnownSaveId: string | undefined;
  private frozen = false;

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
  async mergeFromDisk(activeBase: Entry | null): Promise<{ duplicatedEntryId: string | null }> {
    const disk = await this.readDisk();
    const outcome = mergeDiskState(disk.timelines, disk.entries, activeBase);
    this.timelines = outcome.timelines;
    this.entries = outcome.entries;
    this.frozen = false;
    this.lastKnownSaveId = disk.saveId;
    // Only persist when we actually changed the merged set (a preserved duplicate);
    // otherwise we've simply adopted disk in memory and leave the file untouched.
    if (outcome.duplicatedEntryId) await this.flush();
    return { duplicatedEntryId: outcome.duplicatedEntryId };
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

import type { Timeline, Entry } from '../types';
import type { StorageAdapter } from '../storage/interface';

/**
 * A simple in-memory StorageAdapter for exercising hooks, components, and the
 * import/export helpers without touching IndexedDB or the filesystem. It mirrors
 * the put/delete-by-id semantics of the real adapters.
 */
export class FakeAdapter implements StorageAdapter {
  timelines: Timeline[] = [];
  entries: Entry[] = [];
  blobs = new Map<string, ArrayBuffer>();
  conflict = false;
  mergeResult: { duplicatedEntryId: string | null; importedCount: number } = { duplicatedEntryId: null, importedCount: 0 };

  async getAllTimelines(): Promise<Timeline[]> { return [...this.timelines]; }

  async putTimeline(t: Timeline): Promise<void> {
    const i = this.timelines.findIndex((x) => x.id === t.id);
    if (i >= 0) this.timelines[i] = t; else this.timelines.push(t);
  }

  async deleteTimeline(id: string): Promise<void> {
    this.timelines = this.timelines.filter((t) => t.id !== id);
  }

  async getAllEntries(): Promise<Entry[]> { return [...this.entries]; }

  async getEntriesForTimeline(id: string): Promise<Entry[]> {
    return this.entries.filter((e) => e.timelineId === id);
  }

  async putEntry(e: Entry): Promise<void> {
    const i = this.entries.findIndex((x) => x.id === e.id);
    if (i >= 0) this.entries[i] = e; else this.entries.push(e);
  }

  async deleteEntry(id: string): Promise<void> {
    this.entries = this.entries.filter((e) => e.id !== id);
  }

  async deleteEntriesForTimeline(id: string): Promise<void> {
    this.entries = this.entries.filter((e) => e.timelineId !== id);
  }

  async getBlob(key: string): Promise<ArrayBuffer | undefined> { return this.blobs.get(key); }
  async putBlob(key: string, data: ArrayBuffer): Promise<void> { this.blobs.set(key, data); }
  async deleteBlob(key: string): Promise<void> { this.blobs.delete(key); }
  async clearAll(): Promise<void> {
    this.timelines = [];
    this.entries = [];
    this.blobs.clear();
  }
  async getAllBlobKeys(): Promise<string[]> { return [...this.blobs.keys()]; }

  async getAllBlobs(): Promise<Record<string, ArrayBuffer>> {
    const out: Record<string, ArrayBuffer> = {};
    for (const [k, v] of this.blobs) out[k] = v;
    return out;
  }

  async hasConflict(): Promise<boolean> { return this.conflict; }
  async mergeFromDisk(): Promise<{ duplicatedEntryId: string | null; importedCount: number }> { return this.mergeResult; }
  async mergeConflictFiles(): Promise<{ importedCount: number; conflictCount: number }> { return { importedCount: 0, conflictCount: 0 }; }
}

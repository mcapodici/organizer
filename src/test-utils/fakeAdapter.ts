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
  /** How many times refresh() was called — lets provider tests assert a re-read. */
  refreshCount = 0;

  async getAllTimelines(): Promise<Timeline[]> { return [...this.timelines]; }

  async putTimeline(t: Timeline): Promise<void> {
    const i = this.timelines.findIndex((x) => x.id === t.id);
    if (i >= 0) this.timelines[i] = t; else this.timelines.push(t);
  }

  async deleteTimeline(id: string): Promise<void> {
    this.timelines = this.timelines.filter((t) => t.id !== id);
  }

  async getAllEntries(): Promise<Entry[]> { return [...this.entries]; }

  async getEntry(id: string): Promise<Entry | undefined> {
    return this.entries.find((e) => e.id === id);
  }

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
  async getAllBlobKeys(): Promise<string[]> { return [...this.blobs.keys()]; }

  async getAllBlobs(): Promise<Record<string, ArrayBuffer>> {
    const out: Record<string, ArrayBuffer> = {};
    for (const [k, v] of this.blobs) out[k] = v;
    return out;
  }

  // Nothing is cached, so there is nothing to re-read — just record the call.
  async refresh(): Promise<void> { this.refreshCount += 1; }
}

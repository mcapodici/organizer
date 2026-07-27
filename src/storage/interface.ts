import type { Timeline, Entry } from '../types';

export interface StorageAdapter {
  getAllTimelines(): Promise<Timeline[]>;
  putTimeline(timeline: Timeline): Promise<void>;
  deleteTimeline(id: string): Promise<void>;

  getAllEntries(): Promise<Entry[]>;
  getEntry(id: string): Promise<Entry | undefined>;
  getEntriesForTimeline(timelineId: string): Promise<Entry[]>;
  putEntry(entry: Entry): Promise<void>;
  deleteEntry(id: string): Promise<void>;
  deleteEntriesForTimeline(timelineId: string): Promise<void>;

  getBlob(key: string): Promise<ArrayBuffer | undefined>;
  putBlob(key: string, data: ArrayBuffer): Promise<void>;
  deleteBlob(key: string): Promise<void>;
  getAllBlobKeys(): Promise<string[]>;
  getAllBlobs(): Promise<Record<string, ArrayBuffer>>;

  // Re-read whatever the adapter caches from its backing store, so a write made
  // by another tab becomes visible here. A no-op for adapters that read through.
  refresh(): Promise<void>;
}

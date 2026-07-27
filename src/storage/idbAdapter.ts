import type { Timeline, Entry } from '../types';
import type { StorageAdapter } from './interface';
import * as db from '../db';

export class IdbAdapter implements StorageAdapter {
  getAllTimelines(): Promise<Timeline[]> { return db.getAllTimelines(); }
  getAllEntries(): Promise<Entry[]> { return db.getAllEntries(); }
  getEntry(id: string): Promise<Entry | undefined> { return db.getEntry(id); }
  getEntriesForTimeline(id: string): Promise<Entry[]> { return db.getEntriesForTimeline(id); }
  getBlob(key: string): Promise<ArrayBuffer | undefined> { return db.getBlob(key); }
  getAllBlobKeys(): Promise<string[]> { return db.getAllBlobKeys(); }
  getAllBlobs(): Promise<Record<string, ArrayBuffer>> { return db.getAllBlobs(); }

  putTimeline(t: Timeline): Promise<void> { return db.putTimeline(t); }
  deleteTimeline(id: string): Promise<void> { return db.deleteTimeline(id); }
  putEntry(e: Entry): Promise<void> { return db.putEntry(e); }
  deleteEntry(id: string): Promise<void> { return db.deleteEntry(id); }
  deleteEntriesForTimeline(id: string): Promise<void> { return db.deleteEntriesForTimeline(id); }
  putBlob(key: string, data: ArrayBuffer): Promise<void> { return db.putBlob(key, data); }
  deleteBlob(key: string): Promise<void> { return db.deleteBlob(key); }

  // Nothing is cached — every read goes to IndexedDB, which is shared between
  // tabs, so another tab's write is already visible here.
  async refresh(): Promise<void> { /* no-op */ }
}

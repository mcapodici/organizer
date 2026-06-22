import type { Timeline, Entry } from '../types';

export class ConflictError extends Error {
  constructor() {
    super('Workspace was modified by another tab');
    this.name = 'ConflictError';
  }
}

export interface StorageAdapter {
  getAllTimelines(): Promise<Timeline[]>;
  putTimeline(timeline: Timeline): Promise<void>;
  deleteTimeline(id: string): Promise<void>;

  getAllEntries(): Promise<Entry[]>;
  getEntriesForTimeline(timelineId: string): Promise<Entry[]>;
  putEntry(entry: Entry): Promise<void>;
  deleteEntry(id: string): Promise<void>;
  deleteEntriesForTimeline(timelineId: string): Promise<void>;

  getBlob(key: string): Promise<ArrayBuffer | undefined>;
  putBlob(key: string, data: ArrayBuffer): Promise<void>;
  deleteBlob(key: string): Promise<void>;
  getAllBlobKeys(): Promise<string[]>;
  getAllBlobs(): Promise<Record<string, ArrayBuffer>>;

  hasConflict(): Promise<boolean>;
  mergeFromDisk(activeBase: Entry | null): Promise<{ duplicatedEntryId: string | null; importedCount: number }>;
  // Scan for and merge any external conflict files (e.g. Syncthing
  // `.sync-conflict-*` files), renaming each to `.done` once processed. Adapters
  // without a file backing return zero counts.
  mergeConflictFiles(): Promise<{ importedCount: number; conflictCount: number }>;
}

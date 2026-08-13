import { openDB } from 'idb';
import type { IDBPDatabase } from 'idb';
import type { Timeline, Entry } from '../types';

export interface TimelineDB {
  timelines: {
    key: string;
    value: Timeline;
  };
  entries: {
    key: string;
    value: Entry;
    indexes: { 'by-timeline': string };
  };
  blobs: {
    key: string;
    value: ArrayBuffer;
  };
  meta: {
    key: string;
    value: string;
  };
}

let dbPromise: Promise<IDBPDatabase<TimelineDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<TimelineDB>> {
  if (!dbPromise) {
    dbPromise = openDB<TimelineDB>('timeline-app', 2, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore('timelines', { keyPath: 'id' });
          const entries = db.createObjectStore('entries', { keyPath: 'id' });
          entries.createIndex('by-timeline', 'timelineId');
          db.createObjectStore('blobs');
        }
        if (oldVersion < 2) {
          db.createObjectStore('meta');
        }
      },
    });
  }
  return dbPromise;
}

// Wipe every user-data store in one transaction. `meta` (the saveId marker) is
// left intact so the adapter's conflict tracking keeps working across the wipe.
export async function clearAll(): Promise<void> {
  const d = await getDB();
  const tx = d.transaction(['timelines', 'entries', 'blobs'], 'readwrite');
  await Promise.all([
    tx.objectStore('timelines').clear(),
    tx.objectStore('entries').clear(),
    tx.objectStore('blobs').clear(),
  ]);
  await tx.done;
}

export function resetDB() {
  dbPromise = null;
}

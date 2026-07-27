import type { IDBPDatabase } from 'idb';
import { getDB } from './schema';
import type { TimelineDB } from './schema';
import type { Entry } from '../types';

async function db(): Promise<IDBPDatabase<TimelineDB>> {
  return getDB();
}

export async function getAllEntries(): Promise<Entry[]> {
  return (await db()).getAll('entries');
}

export async function getEntry(id: string): Promise<Entry | undefined> {
  return (await db()).get('entries', id);
}

export async function getEntriesForTimeline(timelineId: string): Promise<Entry[]> {
  return (await db()).getAllFromIndex('entries', 'by-timeline', timelineId);
}

export async function putEntry(entry: Entry): Promise<void> {
  await (await db()).put('entries', entry);
}

export async function deleteEntry(id: string): Promise<void> {
  await (await db()).delete('entries', id);
}

export async function deleteEntriesForTimeline(timelineId: string): Promise<void> {
  const d = await db();
  const entries = await d.getAllFromIndex('entries', 'by-timeline', timelineId);
  const tx = d.transaction('entries', 'readwrite');
  await Promise.all(entries.map((e) => tx.store.delete(e.id)));
  await tx.done;
}

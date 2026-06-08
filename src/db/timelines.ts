import type { IDBPDatabase } from 'idb';
import { getDB } from './schema';
import type { TimelineDB } from './schema';
import type { Timeline } from '../types';

async function db(): Promise<IDBPDatabase<TimelineDB>> {
  return getDB();
}

export async function getAllTimelines(): Promise<Timeline[]> {
  return (await db()).getAll('timelines');
}

export async function getTimeline(id: string): Promise<Timeline | undefined> {
  return (await db()).get('timelines', id);
}

export async function putTimeline(timeline: Timeline): Promise<void> {
  await (await db()).put('timelines', timeline);
}

export async function deleteTimeline(id: string): Promise<void> {
  await (await db()).delete('timelines', id);
}

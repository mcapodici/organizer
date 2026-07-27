import { describe, it, expect, beforeEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { IdbAdapter } from './idbAdapter';
import { resetDB } from '../db/schema';
import type { Timeline, Entry } from '../types';

beforeEach(() => {
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  resetDB();
});

const tl = (id: string): Timeline => ({ id, name: id, createdAt: '2026-01-01T00:00:00Z', tags: [] });
const en = (id: string, timelineId: string): Entry => ({
  id, timelineId, content: id, timestamp: '2026-01-01T00:00:00Z', attachments: [], isStart: false,
});

describe('IdbAdapter — CRUD passthrough', () => {
  it('persists and reads timelines, entries, and blobs', async () => {
    const a = new IdbAdapter();
    await a.putTimeline(tl('t1'));
    await a.putEntry(en('e1', 't1'));
    await a.putEntry(en('e2', 't2'));
    await a.putBlob('b1', new Uint8Array([42]).buffer);

    expect((await a.getAllTimelines()).map((t) => t.id)).toEqual(['t1']);
    expect((await a.getAllEntries()).map((e) => e.id).sort()).toEqual(['e1', 'e2']);
    expect((await a.getEntriesForTimeline('t1')).map((e) => e.id)).toEqual(['e1']);
    expect(new Uint8Array((await a.getBlob('b1'))!)[0]).toBe(42);
    expect(await a.getAllBlobKeys()).toEqual(['b1']);
  });

  it('deletes timelines, entries, and a timeline\'s entries in bulk', async () => {
    const a = new IdbAdapter();
    await a.putTimeline(tl('t1'));
    await a.putEntry(en('e1', 't1'));
    await a.putEntry(en('e2', 't1'));
    await a.deleteEntriesForTimeline('t1');
    expect(await a.getAllEntries()).toEqual([]);
    await a.deleteTimeline('t1');
    expect(await a.getAllTimelines()).toEqual([]);
  });

  it('reads a single entry by id, or undefined when there is none', async () => {
    const a = new IdbAdapter();
    await a.putEntry(en('e1', 't1'));
    expect((await a.getEntry('e1'))?.id).toBe('e1');
    expect(await a.getEntry('nope')).toBeUndefined();
  });

  // IndexedDB is shared between tabs and nothing is cached here, so refresh()
  // has nothing to do — but it must stay safe to call and leave reads working.
  it('refresh() is a safe no-op', async () => {
    const a = new IdbAdapter();
    await a.putEntry(en('e1', 't1'));
    await expect(a.refresh()).resolves.toBeUndefined();
    expect((await a.getAllEntries()).map((e) => e.id)).toEqual(['e1']);
  });
});

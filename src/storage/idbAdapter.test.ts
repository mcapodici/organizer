import { describe, it, expect, beforeEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { IdbAdapter } from './idbAdapter';
import { ConflictError } from './interface';
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
});

describe('IdbAdapter — conflict guard', () => {
  it('reports no conflict for a single adapter writing to its own store', async () => {
    const a = new IdbAdapter();
    expect(await a.hasConflict()).toBe(false);
    await a.putTimeline(tl('t1'));
    expect(await a.hasConflict()).toBe(false);
  });

  it('freezes and rejects writes once another instance changes the saveId', async () => {
    const seed = new IdbAdapter();
    await seed.putTimeline(tl('t1'));

    const a = new IdbAdapter();
    const b = new IdbAdapter();
    expect(await a.hasConflict()).toBe(false); // initialises lastKnownSaveId
    expect(await b.hasConflict()).toBe(false);

    await b.putEntry(en('e1', 't1')); // bumps saveId on shared store

    expect(await a.hasConflict()).toBe(true);
    await expect(a.putEntry(en('e2', 't1'))).rejects.toBeInstanceOf(ConflictError);
  });

  it('stays frozen on repeated checks until merged', async () => {
    const seed = new IdbAdapter();
    await seed.putTimeline(tl('t1'));
    const a = new IdbAdapter();
    const b = new IdbAdapter();
    await a.hasConflict();
    await b.hasConflict();

    await b.putEntry(en('e1', 't1'));
    expect(await a.hasConflict()).toBe(true);
    expect(await a.hasConflict()).toBe(true);

    // After merging with nothing open, A unfreezes and can write again.
    await a.mergeFromDisk(null);
    expect(await a.hasConflict()).toBe(false);
    await expect(a.putEntry(en('e2', 't1'))).resolves.toBeUndefined();
  });
});

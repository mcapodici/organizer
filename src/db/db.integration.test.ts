import { describe, it, expect, beforeEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import {
  getAllTimelines, getTimeline, putTimeline, deleteTimeline,
  getAllEntries, getEntriesForTimeline, putEntry, deleteEntry, deleteEntriesForTimeline,
  getBlob, putBlob, deleteBlob, getAllBlobKeys, getAllBlobs,
} from './index';
import { resetDB } from './schema';
import type { Timeline, Entry } from '../types';

beforeEach(() => {
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  resetDB();
});

const tl = (id: string): Timeline => ({ id, name: id, createdAt: '2026-01-01T00:00:00Z', tags: [] });
const en = (id: string, timelineId: string): Entry => ({
  id, timelineId, content: id, timestamp: '2026-01-01T00:00:00Z', attachments: [], isStart: false,
});

describe('timelines store', () => {
  it('puts, reads, and lists timelines', async () => {
    await putTimeline(tl('a'));
    await putTimeline(tl('b'));
    expect((await getAllTimelines()).map((t) => t.id).sort()).toEqual(['a', 'b']);
    expect((await getTimeline('a'))?.id).toBe('a');
    expect(await getTimeline('missing')).toBeUndefined();
  });

  it('overwrites a timeline with the same id', async () => {
    await putTimeline(tl('a'));
    await putTimeline({ ...tl('a'), name: 'renamed' });
    expect(await getAllTimelines()).toHaveLength(1);
    expect((await getTimeline('a'))?.name).toBe('renamed');
  });

  it('deletes a timeline', async () => {
    await putTimeline(tl('a'));
    await deleteTimeline('a');
    expect(await getAllTimelines()).toEqual([]);
  });
});

describe('entries store', () => {
  it('queries entries by timeline via the index', async () => {
    await putEntry(en('e1', 't1'));
    await putEntry(en('e2', 't1'));
    await putEntry(en('e3', 't2'));
    expect((await getEntriesForTimeline('t1')).map((e) => e.id).sort()).toEqual(['e1', 'e2']);
    expect((await getEntriesForTimeline('t2')).map((e) => e.id)).toEqual(['e3']);
    expect(await getAllEntries()).toHaveLength(3);
  });

  it('deletes a single entry by id', async () => {
    await putEntry(en('e1', 't1'));
    await putEntry(en('e2', 't1'));
    await deleteEntry('e1');
    expect((await getAllEntries()).map((e) => e.id)).toEqual(['e2']);
  });

  it('bulk-deletes every entry for a timeline, leaving others intact', async () => {
    await putEntry(en('e1', 't1'));
    await putEntry(en('e2', 't1'));
    await putEntry(en('keep', 't2'));
    await deleteEntriesForTimeline('t1');
    expect((await getAllEntries()).map((e) => e.id)).toEqual(['keep']);
  });

  it('bulk-delete on an empty timeline is a no-op', async () => {
    await putEntry(en('keep', 't2'));
    await deleteEntriesForTimeline('t1');
    expect(await getAllEntries()).toHaveLength(1);
  });
});

describe('blobs store', () => {
  const buf = (n: number) => new Uint8Array([n]).buffer;

  it('puts and gets a blob', async () => {
    await putBlob('k1', buf(7));
    const got = await getBlob('k1');
    expect(new Uint8Array(got!)[0]).toBe(7);
  });

  it('returns undefined for a missing blob', async () => {
    expect(await getBlob('nope')).toBeUndefined();
  });

  it('lists all blob keys', async () => {
    await putBlob('k1', buf(1));
    await putBlob('k2', buf(2));
    expect((await getAllBlobKeys()).sort()).toEqual(['k1', 'k2']);
  });

  it('getAllBlobs maps each key to its bytes', async () => {
    await putBlob('k1', buf(1));
    await putBlob('k2', buf(2));
    const all = await getAllBlobs();
    expect(Object.keys(all).sort()).toEqual(['k1', 'k2']);
    expect(new Uint8Array(all['k1'])[0]).toBe(1);
    expect(new Uint8Array(all['k2'])[0]).toBe(2);
  });

  it('deletes a blob', async () => {
    await putBlob('k1', buf(1));
    await deleteBlob('k1');
    expect(await getBlob('k1')).toBeUndefined();
    expect(await getAllBlobKeys()).toEqual([]);
  });
});

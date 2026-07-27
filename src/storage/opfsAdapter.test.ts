import { describe, it, expect, beforeEach } from 'vitest';
import { OpfsAdapter } from './opfsAdapter';
import { MockDir } from '../test-utils/mockDir';
import type { Timeline, Entry } from '../types';

// Helper to cast MockDir as FileSystemDirectoryHandle.
function asHandle(d: MockDir): FileSystemDirectoryHandle {
  return d as unknown as FileSystemDirectoryHandle;
}

const TL = (id: string): Timeline => ({ id, name: id, createdAt: '2026-01-01T00:00:00Z', tags: [] });
const EN = (id: string, timelineId: string): Entry => ({
  id, timelineId, content: id, timestamp: '2026-01-01T00:00:00Z', attachments: [], isStart: false,
});

let mockRoot: MockDir;
beforeEach(() => {
  mockRoot = new MockDir();
  // Mock navigator.storage.getDirectory() to return our mock root.
  Object.defineProperty(globalThis, 'navigator', {
    value: {
      storage: {
        getDirectory: () => Promise.resolve(asHandle(mockRoot)),
      },
    },
    configurable: true,
    writable: true,
  });
});

describe('OpfsAdapter — basic persistence', () => {
  it('loads an empty workspace when nothing exists', async () => {
    const a = new OpfsAdapter();
    expect(await a.getAllTimelines()).toEqual([]);
    expect(await a.getAllEntries()).toEqual([]);
  });

  it('persists timelines and entries as one file per entry', async () => {
    const a = new OpfsAdapter();
    await a.putTimeline(TL('t1'));
    await a.putEntry(EN('e1', 't1'));

    // Layout: timelines/<id>/timeline.json, timelines/<id>/entries/<id>.json
    expect(mockRoot.dirs.get('timelines')!.dirs.has('t1')).toBe(true);
    expect(mockRoot.dirs.get('timelines')!.dirs.get('t1')!.files.has('timeline.json')).toBe(true);
    expect(mockRoot.dirs.get('timelines')!.dirs.get('t1')!.dirs.get('entries')!.files.has('e1.json')).toBe(true);

    // A fresh adapter over the same root must see the written state.
    const b = new OpfsAdapter();
    expect((await b.getAllTimelines()).map((t) => t.id)).toEqual(['t1']);
    expect((await b.getAllEntries()).map((e) => e.id)).toEqual(['e1']);
  });

  it('updates a timeline in place rather than appending', async () => {
    const a = new OpfsAdapter();
    await a.putTimeline(TL('t1'));
    await a.putTimeline({ ...TL('t1'), name: 'renamed' });
    const all = await a.getAllTimelines();
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe('renamed');
  });

  it('filters entries by timeline and bulk-deletes them', async () => {
    const a = new OpfsAdapter();
    await a.putEntry(EN('e1', 't1'));
    await a.putEntry(EN('e2', 't1'));
    await a.putEntry(EN('keep', 't2'));
    expect((await a.getEntriesForTimeline('t1')).map((e) => e.id).sort()).toEqual(['e1', 'e2']);
    await a.deleteEntriesForTimeline('t1');
    expect((await a.getAllEntries()).map((e) => e.id)).toEqual(['keep']);
    expect(mockRoot.dirs.get('timelines')!.dirs.get('t1')!.dirs.has('entries')).toBe(false);
  });

  it('deletes a single entry without touching its siblings', async () => {
    const a = new OpfsAdapter();
    await a.putEntry(EN('e1', 't1'));
    await a.putEntry(EN('e2', 't1'));
    await a.deleteEntry('e1');
    const eDir = mockRoot.dirs.get('timelines')!.dirs.get('t1')!.dirs.get('entries')!;
    expect(eDir.files.has('e2.json')).toBe(true);
    expect(eDir.files.has('e1.json')).toBe(false);
    expect((await a.getAllEntries()).map((e) => e.id)).toEqual(['e2']);
  });

  it('deletes a timeline by removing its whole folder', async () => {
    const a = new OpfsAdapter();
    await a.putTimeline(TL('t1'));
    await a.putEntry(EN('e1', 't1'));
    await a.deleteEntriesForTimeline('t1');
    await a.deleteTimeline('t1');
    expect(await a.getAllEntries()).toEqual([]);
    expect(await a.getAllTimelines()).toEqual([]);
    expect(mockRoot.dirs.get('timelines')!.dirs.has('t1')).toBe(false);
  });

  it('moving an entry to another timeline deletes the old file', async () => {
    const a = new OpfsAdapter();
    await a.putEntry(EN('e1', 't1'));
    await a.putEntry({ ...EN('e1', 't1'), timelineId: 't2' });
    const t1e = mockRoot.dirs.get('timelines')!.dirs.get('t1')!.dirs.get('entries');
    expect(t1e?.files.has('e1.json')).toBe(false);
    expect(mockRoot.dirs.get('timelines')!.dirs.get('t2')!.dirs.get('entries')!.files.has('e1.json')).toBe(true);
  });
});

describe('OpfsAdapter — blobs', () => {
  const buf = (n: number) => new Uint8Array([n, n + 1]).buffer;

  it('stores, reads, lists, and deletes blobs in the blobs/ subfolder', async () => {
    const a = new OpfsAdapter();
    await a.putBlob('k1', buf(1));
    await a.putBlob('k2', buf(5));
    expect(mockRoot.dirs.get('blobs')!.files.has('k1.bin')).toBe(true);

    expect(new Uint8Array((await a.getBlob('k1'))!)).toEqual(new Uint8Array([1, 2]));
    expect((await a.getAllBlobKeys()).sort()).toEqual(['k1', 'k2']);

    const all = await a.getAllBlobs();
    expect(Object.keys(all).sort()).toEqual(['k1', 'k2']);

    await a.deleteBlob('k1');
    expect(await a.getBlob('k1')).toBeUndefined();
    expect(await a.getAllBlobKeys()).toEqual(['k2']);
  });

  it('returns undefined / empties for a missing blob and empty store', async () => {
    const a = new OpfsAdapter();
    expect(await a.getBlob('nope')).toBeUndefined();
    expect(await a.getAllBlobKeys()).toEqual([]);
    expect(await a.getAllBlobs()).toEqual({});
    await expect(a.deleteBlob('nope')).resolves.toBeUndefined();
  });
});

describe('OpfsAdapter — refreshing the cached index', () => {
  it('reads a single entry by id, or undefined when there is none', async () => {
    const a = new OpfsAdapter();
    await a.putEntry(EN('e1', 't1'));
    expect((await a.getEntry('e1'))?.id).toBe('e1');
    expect(await a.getEntry('nope')).toBeUndefined();
  });

  // Every read is served from the in-memory index built at init(), so another
  // tab's write is invisible until refresh() re-scans the file tree. Without
  // refresh() the cache has nothing to invalidate it at all.
  it('picks up another adapter\'s write only after refresh()', async () => {
    const a = new OpfsAdapter();
    await a.putEntry(EN('e1', 't1'));

    // A second adapter over the same root stands in for another tab.
    const b = new OpfsAdapter();
    await b.putEntry(EN('e2', 't1'));

    expect((await a.getAllEntries()).map((e) => e.id)).toEqual(['e1']);
    await a.refresh();
    expect((await a.getAllEntries()).map((e) => e.id).sort()).toEqual(['e1', 'e2']);
    expect((await a.getEntry('e2'))?.id).toBe('e2');
  });

  it('drops an entry another adapter deleted', async () => {
    const a = new OpfsAdapter();
    await a.putEntry(EN('e1', 't1'));
    await a.putEntry(EN('e2', 't1'));

    const b = new OpfsAdapter();
    await b.deleteEntry('e1');

    await a.refresh();
    expect((await a.getAllEntries()).map((e) => e.id)).toEqual(['e2']);
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { OpfsAdapter } from './opfsAdapter';
import { ConflictError } from './interface';
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

    // Layout: meta/, timelines/<id>/, entries/<id>.json
    expect(mockRoot.dirs.has('meta')).toBe(true);
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

describe('OpfsAdapter — conflict guard', () => {
  it('reports no conflict for a single adapter writing to its own store', async () => {
    const a = new OpfsAdapter();
    expect(await a.hasConflict()).toBe(false);
    await a.putTimeline(TL('t1'));
    expect(await a.hasConflict()).toBe(false);
  });

  it('freezes and rejects writes once another instance changes the saveId', async () => {
    const seed = new OpfsAdapter();
    await seed.putTimeline(TL('t1'));

    const a = new OpfsAdapter();
    const b = new OpfsAdapter();
    expect(await a.hasConflict()).toBe(false);
    expect(await b.hasConflict()).toBe(false);

    await b.putEntry(EN('e1', 't1'));

    expect(await a.hasConflict()).toBe(true);
    await expect(a.putEntry(EN('e2', 't1'))).rejects.toBeInstanceOf(ConflictError);
  });

  it('stays frozen on repeated checks until merged', async () => {
    const seed = new OpfsAdapter();
    await seed.putTimeline(TL('t1'));
    const a = new OpfsAdapter();
    const b = new OpfsAdapter();
    await a.hasConflict();
    await b.hasConflict();

    await b.putEntry(EN('e1', 't1'));
    expect(await a.hasConflict()).toBe(true);
    expect(await a.hasConflict()).toBe(true);

    await a.mergeFromDisk(null);
    expect(await a.hasConflict()).toBe(false);
    await expect(a.putEntry(EN('e2', 't1'))).resolves.toBeUndefined();
  });
});

describe('OpfsAdapter — corrupt file quarantine', () => {
  it('quarantines an unparseable entry file instead of wedging the scan', async () => {
    // A valid timeline + a valid entry, plus one corrupt entry file on disk.
    mockRoot.seed('timelines/t1/timeline.json', JSON.stringify(TL('t1')));
    mockRoot.seed('timelines/t1/entries/e1.json', JSON.stringify(EN('e1', 't1')));
    mockRoot.seed('timelines/t1/entries/bad.json', '{ not valid json');

    const a = new OpfsAdapter();
    // Scan must not throw; the good data survives and the bad file is gone.
    expect((await a.getAllEntries()).map((e) => e.id)).toEqual(['e1']);
    expect((await a.getAllTimelines()).map((t) => t.id)).toEqual(['t1']);

    const eDir = mockRoot.dirs.get('timelines')!.dirs.get('t1')!.dirs.get('entries')!;
    expect(eDir.files.has('bad.json')).toBe(false);
    expect(eDir.files.has('e1.json')).toBe(true);

    // The corrupt file's contents were copied into quarantine/.
    const qDir = mockRoot.dirs.get('quarantine')!;
    expect(qDir).toBeDefined();
    expect(qDir.files.size).toBe(1);
  });

  it('quarantines a corrupt timeline.json', async () => {
    mockRoot.seed('timelines/t1/timeline.json', 'nonsense');
    const a = new OpfsAdapter();
    expect(await a.getAllTimelines()).toEqual([]);
    const tlDir = mockRoot.dirs.get('timelines')!.dirs.get('t1')!;
    expect(tlDir.files.has('timeline.json')).toBe(false);
    expect(mockRoot.dirs.get('quarantine')!.files.size).toBe(1);
  });

  it('does not wedge mergeFromDisk when a corrupt file appears', async () => {
    const seed = new OpfsAdapter();
    await seed.putTimeline(TL('t1'));
    await seed.putEntry(EN('e1', 't1'));

    // A corrupt file lands on disk before a merge.
    mockRoot.dirs.get('timelines')!.dirs.get('t1')!.dirs.get('entries')!
      .files.set('bad.json', { data: '{oops', mtime: 0 } as never);

    const a = new OpfsAdapter();
    await expect(a.mergeFromDisk(null)).resolves.toBeDefined();
    expect((await a.getAllEntries()).map((e) => e.id)).toEqual(['e1']);
  });
});

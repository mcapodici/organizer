import { describe, it, expect, beforeEach } from 'vitest';
import { FileAdapter, listWorkspaces } from './fileAdapter';
import { ConflictError } from './interface';
import { MockDir } from '../test-utils/mockDir';
import type { Timeline, Entry } from '../types';

const tl = (id: string): Timeline => ({ id, name: id, createdAt: '2026-01-01T00:00:00Z', tags: [] });
const en = (id: string, timelineId: string): Entry => ({
  id, timelineId, content: id, timestamp: '2026-01-01T00:00:00Z', attachments: [], isStart: false,
});

let dir: MockDir;
beforeEach(() => { dir = new MockDir(); });

function asHandle(d: MockDir): FileSystemDirectoryHandle {
  return d as unknown as FileSystemDirectoryHandle;
}

// Navigate the on-disk tree the adapter produces for a workspace.
const wsRoot = (ws = 'ws') => dir.dirs.get(ws);
const timelineFolder = (tid: string, ws = 'ws') => wsRoot(ws)?.dirs.get('timelines')?.dirs.get(tid);
const entryFiles = (tid: string, ws = 'ws') =>
  [...(timelineFolder(tid, ws)?.dirs.get('entries')?.files.keys() ?? [])];

describe('FileAdapter — basic persistence', () => {
  it('loads an empty workspace when nothing exists', async () => {
    const a = await FileAdapter.load(asHandle(dir), 'ws');
    expect(await a.getAllTimelines()).toEqual([]);
    expect(await a.getAllEntries()).toEqual([]);
    expect(a.workspaceName).toBe('ws');
  });

  it('persists timelines and entries as one file per entry', async () => {
    const a = await FileAdapter.load(asHandle(dir), 'ws');
    await a.putTimeline(tl('t1'));
    await a.putEntry(en('e1', 't1'));

    // Layout: a workspace marker, a per-timeline folder, and a file per entry.
    expect(wsRoot()!.files.has('workspace.json')).toBe(true);
    expect(timelineFolder('t1')!.files.has('timeline.json')).toBe(true);
    expect(entryFiles('t1')).toEqual(['e1.json']);

    // A fresh adapter over the same directory must see the written state.
    const b = await FileAdapter.load(asHandle(dir), 'ws');
    expect((await b.getAllTimelines()).map((t) => t.id)).toEqual(['t1']);
    expect((await b.getAllEntries()).map((e) => e.id)).toEqual(['e1']);
  });

  it('updates a timeline in place rather than appending', async () => {
    const a = await FileAdapter.load(asHandle(dir), 'ws');
    await a.putTimeline(tl('t1'));
    await a.putTimeline({ ...tl('t1'), name: 'renamed' });
    const all = await a.getAllTimelines();
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe('renamed');
  });

  it('filters entries by timeline and bulk-deletes them', async () => {
    const a = await FileAdapter.load(asHandle(dir), 'ws');
    await a.putEntry(en('e1', 't1'));
    await a.putEntry(en('e2', 't1'));
    await a.putEntry(en('keep', 't2'));
    expect((await a.getEntriesForTimeline('t1')).map((e) => e.id).sort()).toEqual(['e1', 'e2']);
    await a.deleteEntriesForTimeline('t1');
    expect((await a.getAllEntries()).map((e) => e.id)).toEqual(['keep']);
    expect(timelineFolder('t1')!.dirs.has('entries')).toBe(false);
  });

  it('deletes a single entry without touching its siblings', async () => {
    const a = await FileAdapter.load(asHandle(dir), 'ws');
    await a.putEntry(en('e1', 't1'));
    await a.putEntry(en('e2', 't1'));
    await a.deleteEntry('e1');
    expect(entryFiles('t1')).toEqual(['e2.json']);
    expect((await a.getAllEntries()).map((e) => e.id)).toEqual(['e2']);
  });

  it('deletes a timeline by removing its whole folder', async () => {
    const a = await FileAdapter.load(asHandle(dir), 'ws');
    await a.putTimeline(tl('t1'));
    await a.putEntry(en('e1', 't1'));
    await a.deleteEntriesForTimeline('t1');
    await a.deleteTimeline('t1');
    expect(await a.getAllEntries()).toEqual([]);
    expect(await a.getAllTimelines()).toEqual([]);
    expect(wsRoot()!.dirs.get('timelines')!.dirs.has('t1')).toBe(false);
  });

  it('moving an entry to another timeline deletes the old file', async () => {
    const a = await FileAdapter.load(asHandle(dir), 'ws');
    await a.putEntry(en('e1', 't1'));
    await a.putEntry({ ...en('e1', 't1'), timelineId: 't2' });
    expect(entryFiles('t1')).toEqual([]);
    expect(entryFiles('t2')).toEqual(['e1.json']);
    expect((await a.getEntriesForTimeline('t2')).map((e) => e.id)).toEqual(['e1']);
  });
});

describe('FileAdapter — blobs', () => {
  const buf = (n: number) => new Uint8Array([n, n + 1]).buffer;

  it('stores, reads, lists, and deletes blobs in the blobs/ subfolder', async () => {
    const a = await FileAdapter.load(asHandle(dir), 'ws');
    await a.putBlob('k1', buf(1));
    await a.putBlob('k2', buf(5));
    expect(wsRoot()!.dirs.get('blobs')!.files.has('k1.bin')).toBe(true);

    expect(new Uint8Array((await a.getBlob('k1'))!)).toEqual(new Uint8Array([1, 2]));
    expect((await a.getAllBlobKeys()).sort()).toEqual(['k1', 'k2']);

    const all = await a.getAllBlobs();
    expect(Object.keys(all).sort()).toEqual(['k1', 'k2']);

    await a.deleteBlob('k1');
    expect(await a.getBlob('k1')).toBeUndefined();
    expect(await a.getAllBlobKeys()).toEqual(['k2']);
  });

  it('returns undefined / empties for a missing blob and empty store', async () => {
    const a = await FileAdapter.load(asHandle(dir), 'ws');
    expect(await a.getBlob('nope')).toBeUndefined();
    expect(await a.getAllBlobKeys()).toEqual([]);
    expect(await a.getAllBlobs()).toEqual({});
    await expect(a.deleteBlob('nope')).resolves.toBeUndefined();
  });
});

describe('listWorkspaces', () => {
  it('returns sorted folder-based workspace names', async () => {
    await (await FileAdapter.load(asHandle(dir), 'zebra')).putTimeline(tl('t'));
    await (await FileAdapter.load(asHandle(dir), 'alpha')).putTimeline(tl('t'));
    expect(await listWorkspaces(asHandle(dir))).toEqual(['alpha', 'zebra']);
  });

  it('returns an empty list for a directory with no workspaces', async () => {
    expect(await listWorkspaces(asHandle(dir))).toEqual([]);
  });

  it('lists a not-yet-migrated legacy workspace exactly once', async () => {
    // A legacy `<ws>.json` file alongside its old blob folder (no marker yet).
    dir.seed('ws.json', JSON.stringify({ version: 2, timelines: [], entries: [] }));
    dir.seed('ws/blob-x.bin', new Uint8Array([1]).buffer);
    expect(await listWorkspaces(asHandle(dir))).toEqual(['ws']);
  });
});

describe('FileAdapter — migration from the legacy single-file layout', () => {
  const buf = new Uint8Array([7, 8]).buffer;

  it('converts <ws>.json + blobs into the per-entry tree and archives the old file', async () => {
    dir.seed('ws.json', JSON.stringify({
      version: 2,
      timelines: [tl('t1')],
      entries: [en('e1', 't1')],
    }));
    dir.seed('ws/blob-x.bin', buf); // old blobs lived at the top of the <ws>/ folder

    const a = await FileAdapter.load(asHandle(dir), 'ws');

    // Data is intact and now lives in the new layout.
    expect((await a.getAllTimelines()).map((t) => t.id)).toEqual(['t1']);
    expect((await a.getAllEntries()).map((e) => e.id)).toEqual(['e1']);
    expect(timelineFolder('t1')!.files.has('timeline.json')).toBe(true);
    expect(entryFiles('t1')).toEqual(['e1.json']);

    // Blobs moved down into blobs/ and are still readable.
    expect(new Uint8Array((await a.getBlob('blob-x'))!)).toEqual(new Uint8Array([7, 8]));
    expect(wsRoot()!.files.has('blob-x.bin')).toBe(false);

    // The legacy file is archived, not deleted, and no longer listed.
    expect(dir.files.has('ws.json')).toBe(false);
    expect(dir.files.has('ws.json.migrated')).toBe(true);
    expect(await listWorkspaces(asHandle(dir))).toEqual(['ws']);
  });

  it('does not re-migrate once the marker exists', async () => {
    dir.seed('ws.json', JSON.stringify({ version: 2, timelines: [tl('t1')], entries: [] }));
    await FileAdapter.load(asHandle(dir), 'ws');
    // Drop a second legacy file back in; a marker now exists so it must be ignored.
    dir.seed('ws.json', JSON.stringify({ version: 2, timelines: [tl('ghost')], entries: [] }));
    const b = await FileAdapter.load(asHandle(dir), 'ws');
    expect((await b.getAllTimelines()).map((t) => t.id)).toEqual(['t1']);
  });
});

describe('FileAdapter — Syncthing conflict files', () => {
  const doc = (text: string) =>
    JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });

  it('merges per-entry conflict files, reports counts, and renames them to .done', async () => {
    const a = await FileAdapter.load(asHandle(dir), 'ws');
    await a.putTimeline(tl('t1'));
    await a.putEntry({ ...en('shared', 't1'), content: doc('mine') });

    // One conflict file per entry, living next to the entry it conflicts with.
    dir.seed('ws/timelines/t1/entries/fresh.sync-conflict-20240101-120000-AAAA.json',
      JSON.stringify({ ...en('fresh', 't1'), content: doc('brand new') }));
    dir.seed('ws/timelines/t1/entries/shared.sync-conflict-20240101-120000-AAAA.json',
      JSON.stringify({ ...en('shared', 't1'), content: doc('theirs') }));

    const result = await a.mergeConflictFiles();
    expect(result.importedCount).toBe(2); // one new + one conflicting duplicate
    expect(result.conflictCount).toBe(1);

    const ids = (await a.getAllEntries()).map((e) => e.id);
    expect(ids).toContain('fresh');
    expect(ids.filter((id) => id === 'shared')).toHaveLength(1); // original kept once
    expect(await a.getAllEntries()).toHaveLength(3); // shared + fresh + duplicate

    const eDir = timelineFolder('t1')!.dirs.get('entries')!;
    expect(eDir.files.has('shared.sync-conflict-20240101-120000-AAAA.json')).toBe(false);
    expect(eDir.files.has('shared.sync-conflict-20240101-120000-AAAA.json.done')).toBe(true);
    expect(eDir.files.has('fresh.json')).toBe(true); // the imported entry was persisted

    // A second run finds nothing to do.
    expect((await a.mergeConflictFiles()).importedCount).toBe(0);
  });

  it('merges a timeline-metadata conflict, keeping the later updatedAt', async () => {
    const a = await FileAdapter.load(asHandle(dir), 'ws');
    await a.putTimeline({ ...tl('t1'), name: 'mine', updatedAt: '2026-01-01T00:00:00Z' });

    dir.seed('ws/timelines/t1/timeline.sync-conflict-20240101-120000-AAAA.json',
      JSON.stringify({ ...tl('t1'), name: 'renamed elsewhere', updatedAt: '2026-02-01T00:00:00Z' }));

    await a.mergeConflictFiles();
    expect((await a.getAllTimelines())[0].name).toBe('renamed elsewhere');
    expect(timelineFolder('t1')!.files.has('timeline.sync-conflict-20240101-120000-AAAA.json.done')).toBe(true);
  });

  it('still renames to .done via fallback when move() throws (the prod bug)', async () => {
    dir.moveMode = 'throws'; // move() exists but rejects, as on some picked dirs
    const a = await FileAdapter.load(asHandle(dir), 'ws');
    await a.putEntry({ ...en('shared', 't1'), content: doc('mine') });

    dir.seed('ws/timelines/t1/entries/shared.sync-conflict-20240101-120000-AAAA.json',
      JSON.stringify({ ...en('shared', 't1'), content: doc('theirs') }));

    const first = await a.mergeConflictFiles();
    expect(first.conflictCount).toBe(1);
    const eDir = timelineFolder('t1')!.dirs.get('entries')!;
    expect(eDir.files.has('shared.sync-conflict-20240101-120000-AAAA.json')).toBe(false);
    expect(eDir.files.has('shared.sync-conflict-20240101-120000-AAAA.json.done')).toBe(true);
  });

  it('does not merge the same conflict file twice even if it is never renamed', async () => {
    const a = await FileAdapter.load(asHandle(dir), 'ws');
    await a.putEntry({ ...en('shared', 't1'), content: doc('mine') });

    dir.seed('ws/timelines/t1/entries/shared.sync-conflict-20240101-120000-AAAA.json',
      JSON.stringify({ ...en('shared', 't1'), content: doc('theirs') }));
    // Simulate renaming being impossible: removeEntry is a no-op on the entries
    // folder, so the conflict file lingers on disk after the first merge.
    const eDir = timelineFolder('t1')!.dirs.get('entries')!;
    eDir.removeEntry = async () => { /* rename can't complete */ };

    const first = await a.mergeConflictFiles();
    expect(first.conflictCount).toBe(1);
    expect(eDir.files.has('shared.sync-conflict-20240101-120000-AAAA.json')).toBe(true); // still there

    const second = await a.mergeConflictFiles();
    expect(second.importedCount).toBe(0);
    expect(second.conflictCount).toBe(0);
    expect(await a.getAllEntries()).toHaveLength(2); // shared + one duplicate, not three
  });

  it('splits a conflicting attachment blob into a second attachment', async () => {
    const a = await FileAdapter.load(asHandle(dir), 'ws');
    await a.putBlob('blob-original', new Uint8Array([1, 2]).buffer);
    await a.putEntry({
      ...en('e1', 't1'),
      attachments: [{ id: 'att1', name: 'photo.png', mimeType: 'image/png', size: 2, blobKey: 'blob-original' }],
    });
    // Syncthing names a blob conflict <key>.sync-conflict-*.bin in the blobs/ folder.
    dir.seed('ws/blobs/blob-original.sync-conflict-20240101-120000-AAAA.bin', new Uint8Array([9, 9]).buffer);

    await a.mergeConflictFiles();

    const e1 = (await a.getAllEntries()).find((e) => e.id === 'e1')!;
    expect(e1.attachments).toHaveLength(2);
    const copy = e1.attachments.find((at) => at.name.includes('conflicted copy'))!;
    expect(copy.blobKey).not.toBe('blob-original');
    expect(new Uint8Array((await a.getBlob(copy.blobKey))!)).toEqual(new Uint8Array([9, 9]));
  });
});

describe('FileAdapter — cross-tab / external change handling', () => {
  const doc = (text: string) =>
    JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });

  // Seed a workspace, then return two adapters synced to the same on-disk state.
  async function twoTabs() {
    const seed = await FileAdapter.load(asHandle(dir), 'ws');
    await seed.putTimeline(tl('t1'));
    await seed.putEntry(en('n1', 't1'));
    const a = await FileAdapter.load(asHandle(dir), 'ws');
    const b = await FileAdapter.load(asHandle(dir), 'ws');
    expect(await a.hasConflict()).toBe(false);
    expect(await b.hasConflict()).toBe(false);
    return { a, b };
  }

  it('does not report a conflict for a freshly-loaded workspace', async () => {
    const a = await FileAdapter.load(asHandle(dir), 'ws');
    expect(await a.hasConflict()).toBe(false);
  });

  it('rejects a write to an entry another tab changed, but allows unrelated writes', async () => {
    const { a, b } = await twoTabs();
    await b.putEntry({ ...en('n1', 't1'), content: 'changed by b' });
    // The same entry now diverges on disk → writing it must not clobber b.
    await expect(a.putEntry({ ...en('n1', 't1'), content: 'changed by a' })).rejects.toBeInstanceOf(ConflictError);
    // A different entry lives in its own file, so it is safe to write.
    await expect(a.putEntry(en('n2', 't1'))).resolves.toBeUndefined();
  });

  it('detects a clean external add and adopts it via mergeFromDisk', async () => {
    const { a, b } = await twoTabs();
    await b.putEntry(en('n2', 't1')); // a brand-new entry from another tab
    expect(await a.hasConflict()).toBe(true);

    const result = await a.mergeFromDisk(null);
    expect(result.duplicatedEntryId).toBeNull();
    expect(await a.hasConflict()).toBe(false);
    expect((await a.getAllEntries()).map((e) => e.id).sort()).toEqual(['n1', 'n2']);
    await expect(a.putEntry(en('n3', 't1'))).resolves.toBeUndefined();
  });

  it('mergeFromDisk preserves a divergently-edited note as a marked duplicate', async () => {
    const activeBase: Entry = { ...en('n1', 't1'), content: doc('my draft') };
    const { a, b } = await twoTabs();
    // Tab B changes the same note A is editing.
    await b.putEntry({ ...en('n1', 't1'), content: doc('changed by B') });
    expect(await a.hasConflict()).toBe(true);

    const result = await a.mergeFromDisk(activeBase);
    expect(result.duplicatedEntryId).not.toBeNull();
    const entries = await a.getAllEntries();
    // n1 restored to the editor's base so the in-progress edit can save over it.
    expect(entries.find((e) => e.id === 'n1')!.content).toBe(activeBase.content);
    const dup = entries.find((e) => e.id === result.duplicatedEntryId);
    expect(dup!.content).toContain('Merged copy from another device');
    expect(dup!.content).toContain('changed by B');
    // The preserved duplicate was written to disk.
    expect(entryFiles('t1')).toContain(`${result.duplicatedEntryId}.json`);
  });
});

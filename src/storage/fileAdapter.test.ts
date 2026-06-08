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

describe('FileAdapter — basic persistence', () => {
  it('loads an empty workspace when the file does not exist', async () => {
    const a = await FileAdapter.load(asHandle(dir), 'ws');
    expect(await a.getAllTimelines()).toEqual([]);
    expect(await a.getAllEntries()).toEqual([]);
    expect(a.workspaceName).toBe('ws');
  });

  it('persists timelines and entries to the JSON file', async () => {
    const a = await FileAdapter.load(asHandle(dir), 'ws');
    await a.putTimeline(tl('t1'));
    await a.putEntry(en('e1', 't1'));

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
  });

  it('deletes single timelines and entries', async () => {
    const a = await FileAdapter.load(asHandle(dir), 'ws');
    await a.putTimeline(tl('t1'));
    await a.putEntry(en('e1', 't1'));
    await a.deleteEntry('e1');
    await a.deleteTimeline('t1');
    expect(await a.getAllEntries()).toEqual([]);
    expect(await a.getAllTimelines()).toEqual([]);
  });
});

describe('FileAdapter — blobs', () => {
  const buf = (n: number) => new Uint8Array([n, n + 1]).buffer;

  it('stores, reads, lists, and deletes blobs in the workspace subdirectory', async () => {
    const a = await FileAdapter.load(asHandle(dir), 'ws');
    await a.putBlob('k1', buf(1));
    await a.putBlob('k2', buf(5));

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
    // deleting a non-existent blob must not throw
    await expect(a.deleteBlob('nope')).resolves.toBeUndefined();
  });
});

describe('listWorkspaces', () => {
  it('returns sorted workspace names derived from .json files', async () => {
    await (await FileAdapter.load(asHandle(dir), 'zebra')).putTimeline(tl('t'));
    await (await FileAdapter.load(asHandle(dir), 'alpha')).putTimeline(tl('t'));
    expect(await listWorkspaces(asHandle(dir))).toEqual(['alpha', 'zebra']);
  });

  it('returns an empty list for a directory with no workspaces', async () => {
    expect(await listWorkspaces(asHandle(dir))).toEqual([]);
  });
});

describe('FileAdapter — cross-tab conflict handling', () => {
  // Seed a workspace, then return two adapters synced to the same saveId.
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

  it('does not report a conflict before any saveId is known', async () => {
    const a = await FileAdapter.load(asHandle(dir), 'ws');
    expect(await a.hasConflict()).toBe(false);
  });

  it('detects another tab\'s write, freezes, and blocks further writes', async () => {
    const { a, b } = await twoTabs();
    await b.putEntry(en('n2', 't1'));
    expect(await a.hasConflict()).toBe(true);
    await expect(a.putEntry(en('n3', 't1'))).rejects.toBeInstanceOf(ConflictError);
  });

  it('stays frozen once tripped, even if the saveId later matches again', async () => {
    const { a, b } = await twoTabs();
    await b.putEntry(en('n2', 't1'));
    expect(await a.hasConflict()).toBe(true);
    // Subsequent checks keep returning true (latched).
    expect(await a.hasConflict()).toBe(true);
  });

  it('mergeFromDisk with no active edit adopts disk state and unfreezes', async () => {
    const { a, b } = await twoTabs();
    await b.putEntry(en('n2', 't1'));
    expect(await a.hasConflict()).toBe(true);

    const result = await a.mergeFromDisk(null);
    expect(result.duplicatedEntryId).toBeNull();
    expect(await a.hasConflict()).toBe(false);
    expect((await a.getAllEntries()).map((e) => e.id).sort()).toEqual(['n1', 'n2']);
    // Can write again without throwing.
    await expect(a.putEntry(en('n3', 't1'))).resolves.toBeUndefined();
  });

  it('mergeFromDisk preserves a divergently-edited note as a marked duplicate', async () => {
    // markMergedCopy only injects its banner into valid TipTap JSON, so the
    // diverging note must carry JSON content.
    const doc = (text: string) =>
      JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });
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
  });
});

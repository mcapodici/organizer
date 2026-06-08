import { describe, it, expect, beforeEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { IdbAdapter } from './idbAdapter';
import { resetDB } from '../db/schema';
import type { Entry, Timeline } from '../types';

// These are the three cross-tab "Merge in changes" scenarios, verified end-to-end
// in a real browser, captured here as deterministic tests. fake-indexeddb gives us
// a real IndexedDB; two IdbAdapter instances over the same shared store stand in
// for two browser tabs pointing at the same workspace.

// Fresh, empty IndexedDB before each test, and drop the cached db connection so the
// next getDB() reopens against it — full isolation between cases.
beforeEach(() => {
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  resetDB();
});

const TL: Timeline = { id: 't1', name: 'T', createdAt: '2026-01-01T00:00:00Z', tags: [] };

const doc = (text: string) =>
  JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });

function entry(id: string, content: string): Entry {
  return { id, timelineId: TL.id, content, timestamp: '2026-01-01T00:00:00Z', attachments: [], isStart: false };
}

// Seed the shared store with a timeline + notes, then return two tabs synced to it.
async function twoSyncedTabs(seedEntries: Entry[]): Promise<{ a: IdbAdapter; b: IdbAdapter }> {
  const seed = new IdbAdapter();
  await seed.putTimeline(TL);
  for (const e of seedEntries) await seed.putEntry(e);
  const a = new IdbAdapter();
  const b = new IdbAdapter();
  // hasConflict() initialises each adapter's lastKnownSaveId to the on-disk value.
  expect(await a.hasConflict()).toBe(false);
  expect(await b.hasConflict()).toBe(false);
  return { a, b };
}

describe('IdbAdapter merge — two tabs on shared storage', () => {
  it('Case 1: not editing — adopts the other tab’s change and unfreezes', async () => {
    const { a, b } = await twoSyncedTabs([entry('n1', doc('Note added by Tab B'))]);

    // Tab B adds a new note.
    await b.putEntry(entry('n2', doc('Brand new from B')));

    // Tab A detects the conflict and freezes.
    expect(await a.hasConflict()).toBe(true);

    // Merge with nothing open in the editor: adopt, no duplicate.
    const result = await a.mergeFromDisk(null);
    expect(result.duplicatedEntryId).toBeNull();

    // Unfrozen, and B's note is now visible to A.
    expect(await a.hasConflict()).toBe(false);
    expect((await a.getAllEntries()).map((e) => e.id).sort()).toEqual(['n1', 'n2']);

    // A can save again without throwing.
    await expect(a.putEntry(entry('n3', doc('A again')))).resolves.toBeUndefined();
  });

  it('Case 2: editing the changed note — keeps the draft’s id, preserves the disk version as a marked duplicate', async () => {
    const activeBase = entry('n1', doc('Note added by Tab B'));
    const { a, b } = await twoSyncedTabs([activeBase]);

    // Tab B changes the same note A is editing, and saves.
    await b.putEntry(entry('n1', doc('CHANGED on disk by Tab B')));
    expect(await a.hasConflict()).toBe(true);

    const result = await a.mergeFromDisk(activeBase);
    expect(result.duplicatedEntryId).not.toBeNull();

    const entries = await a.getAllEntries();
    // n1 is restored to A's pre-edit base so A's in-progress edit can save over it.
    expect(entries.find((e) => e.id === 'n1')?.content).toBe(activeBase.content);
    // The disk version survives as a new, marked duplicate.
    const dup = entries.find((e) => e.id === result.duplicatedEntryId);
    expect(dup?.content).toContain('Merged copy from another device');
    expect(dup?.content).toContain('CHANGED on disk by Tab B');

    // A saves its draft over n1 — both versions now coexist, nothing lost.
    await a.putEntry({ ...activeBase, content: doc('A saved edit') });
    const after = await a.getAllEntries();
    expect(after.find((e) => e.id === 'n1')?.content).toBe(doc('A saved edit'));
    expect(after.find((e) => e.id === result.duplicatedEntryId)?.content).toContain('CHANGED on disk by Tab B');
  });

  it('Case 3: editing a different note — adopts the change, no duplicate', async () => {
    const noteB = entry('n1', doc('Note added by Tab B'));
    const { a, b } = await twoSyncedTabs([noteB, entry('n2', doc('Other note'))]);

    // A is editing n1; Tab B changes a DIFFERENT note (n2).
    await b.putEntry(entry('n2', doc('Other note CHANGED by B')));
    expect(await a.hasConflict()).toBe(true);

    const result = await a.mergeFromDisk(noteB);
    expect(result.duplicatedEntryId).toBeNull();

    const entries = await a.getAllEntries();
    expect(entries).toHaveLength(2); // no duplicate created
    expect(entries.find((e) => e.id === 'n1')?.content).toBe(noteB.content); // untouched
    expect(entries.find((e) => e.id === 'n2')?.content).toBe(doc('Other note CHANGED by B')); // adopted
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { IdbAdapter } from './idbAdapter';
import { saveEntry } from './saveEntry';
import { resetDB } from '../db/schema';
import type { Entry, Timeline } from '../types';

// The three cross-tab scenarios the old freeze/merge protocol was protecting,
// re-verified against the model that replaced it. fake-indexeddb gives us a real
// IndexedDB; two IdbAdapter instances over the same shared store stand in for two
// browser tabs pointing at the same data.

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

// Seed the shared store with a timeline + notes, then return two tabs over it.
async function twoTabs(seedEntries: Entry[]): Promise<{ a: IdbAdapter; b: IdbAdapter }> {
  const seed = new IdbAdapter();
  await seed.putTimeline(TL);
  for (const e of seedEntries) await saveEntry(seed, e);
  return { a: new IdbAdapter(), b: new IdbAdapter() };
}

describe('two tabs on one shared store', () => {
  it('Case 1: tab B adds a note — tab A sees it after refresh and can still write', async () => {
    const { a, b } = await twoTabs([entry('n1', doc('Note one'))]);

    await saveEntry(b, entry('n2', doc('Brand new from B')));

    await a.refresh();
    expect((await a.getAllEntries()).map((e) => e.id).sort()).toEqual(['n1', 'n2']);

    // No freeze: A's own writes still go through.
    await expect(saveEntry(a, entry('n3', doc('A again')))).resolves.toMatchObject({
      duplicatedEntryId: null,
    });
    expect((await a.getAllEntries()).map((e) => e.id).sort()).toEqual(['n1', 'n2', 'n3']);
  });

  it('Case 2: both tabs edit the same note — both versions are kept', async () => {
    const { a, b } = await twoTabs([entry('n1', doc('Note one'))]);

    // A loads n1 and starts editing it.
    const aDraft = { ...(await a.getEntry('n1'))!, content: doc('A saved edit') };
    // B changes the same note first.
    const bVersion = { ...(await b.getEntry('n1'))!, content: doc('CHANGED by Tab B') };
    await saveEntry(b, bVersion);

    // A saves its stale draft.
    const result = await saveEntry(a, aDraft);
    expect(result.duplicatedEntryId).not.toBeNull();

    const entries = await a.getAllEntries();
    expect(entries).toHaveLength(2);
    // n1 holds A's content...
    expect(entries.find((e) => e.id === 'n1')?.content).toBe(doc('A saved edit'));
    // ...and B's version survives as a marked duplicate.
    const dup = entries.find((e) => e.id === result.duplicatedEntryId);
    expect(dup?.content).toContain('Merged copy from another device');
    expect(dup?.content).toContain('CHANGED by Tab B');
  });

  it('Case 3: the tabs edit different notes — both changes survive, no duplicate', async () => {
    const { a, b } = await twoTabs([entry('n1', doc('Note one')), entry('n2', doc('Note two'))]);

    const aDraft = { ...(await a.getEntry('n1'))!, content: doc('n1 changed by A') };
    await saveEntry(b, { ...(await b.getEntry('n2'))!, content: doc('n2 changed by B') });

    const result = await saveEntry(a, aDraft);
    expect(result.duplicatedEntryId).toBeNull();

    const entries = await a.getAllEntries();
    expect(entries).toHaveLength(2); // no duplicate created
    expect(entries.find((e) => e.id === 'n1')?.content).toBe(doc('n1 changed by A'));
    expect(entries.find((e) => e.id === 'n2')?.content).toBe(doc('n2 changed by B'));
  });
});

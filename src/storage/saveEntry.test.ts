import { describe, it, expect, beforeEach } from 'vitest';
import { saveEntry } from './saveEntry';
import { FakeAdapter } from '../test-utils/fakeAdapter';
import type { Entry } from '../types';

const doc = (text: string) =>
  JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });

const en = (id: string, content: string, over: Partial<Entry> = {}): Entry => ({
  id, timelineId: 't1', content, timestamp: '2026-01-01T00:00:00Z', attachments: [], isStart: false, ...over,
});

let adapter: FakeAdapter;
beforeEach(() => { adapter = new FakeAdapter(); });

describe('saveEntry', () => {
  it('gives a brand-new entry a rev and creates no duplicate', async () => {
    const result = await saveEntry(adapter, en('e1', doc('hello')));
    expect(result.duplicatedEntryId).toBeNull();
    expect(adapter.entries).toHaveLength(1);
    expect(adapter.entries[0].rev).toBeTruthy();
  });

  it('overwrites in place with a fresh rev when the revs match', async () => {
    await saveEntry(adapter, en('e1', doc('first')));
    const stored = adapter.entries[0];

    const result = await saveEntry(adapter, { ...stored, content: doc('second') });

    expect(result.duplicatedEntryId).toBeNull();
    expect(adapter.entries).toHaveLength(1);
    expect(adapter.entries[0].content).toBe(doc('second'));
    expect(adapter.entries[0].rev).toBeTruthy();
    expect(adapter.entries[0].rev).not.toBe(stored.rev);
  });

  it('keeps both versions when the stored rev has moved on', async () => {
    // This tab loaded e1...
    await saveEntry(adapter, en('e1', doc('original')));
    const mine = { ...adapter.entries[0], content: doc('my edit') };
    // ...then another tab saved over it, minting a different rev.
    await saveEntry(adapter, en('e1', doc('their edit'), { rev: mine.rev }));

    const result = await saveEntry(adapter, mine);

    expect(result.duplicatedEntryId).not.toBeNull();
    expect(adapter.entries).toHaveLength(2);
    // This tab's version keeps its own id.
    expect(adapter.entries.find((e) => e.id === 'e1')?.content).toBe(doc('my edit'));
    // The other tab's version survives under a new id, visibly marked.
    const dup = adapter.entries.find((e) => e.id === result.duplicatedEntryId)!;
    expect(dup.content).toContain('Merged copy from another device');
    expect(dup.content).toContain('their edit');
    expect(dup.rev).toBeTruthy();
  });

  it('falls back to last-write-wins for stored data with no rev', async () => {
    // Pre-migration data: written straight through the adapter, so no rev.
    await adapter.putEntry(en('e1', doc('old data')));

    const result = await saveEntry(adapter, en('e1', doc('my edit')));

    expect(result.duplicatedEntryId).toBeNull();
    expect(adapter.entries).toHaveLength(1);
    expect(adapter.entries[0].content).toBe(doc('my edit'));
    // ...and it self-heals: the record now carries a rev.
    expect(adapter.entries[0].rev).toBeTruthy();
  });
});

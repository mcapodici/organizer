import { describe, it, expect } from 'vitest';
import { mergeDiskState, mergeForeignState, markMergedCopy } from './merge';
import type { Entry, Timeline } from '../types';

const tl: Timeline = { id: 't1', name: 'T', createdAt: '2026-01-01T00:00:00Z', tags: [] };

function entry(id: string, content: string): Entry {
  return { id, timelineId: 't1', content, timestamp: '2026-01-01T00:00:00Z', attachments: [], isStart: false };
}

const doc = (text: string) => JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });

describe('mergeDiskState', () => {
  it('adopts disk wholesale when no note is being edited', () => {
    const disk = [entry('a', doc('disk a'))];
    const out = mergeDiskState([tl], disk, null);
    expect(out.entries).toEqual(disk);
    expect(out.timelines).toEqual([tl]);
    expect(out.duplicatedEntryId).toBeNull();
  });

  it('does not duplicate when the edited note is unchanged on disk', () => {
    const base = entry('a', doc('same'));
    const disk = [entry('a', doc('same')), entry('b', doc('other'))];
    const out = mergeDiskState([tl], disk, base);
    expect(out.duplicatedEntryId).toBeNull();
    expect(out.entries).toEqual(disk);
  });

  it('keeps the edited note under its id and preserves the disk version as a marked duplicate', () => {
    const base = entry('a', doc('my edit base'));
    const diskA = entry('a', doc('their edit'));
    const out = mergeDiskState([tl], [diskA], base);

    expect(out.duplicatedEntryId).not.toBeNull();
    // The note under id 'a' is the editor's base, ready to be saved over.
    const kept = out.entries.find((e) => e.id === 'a');
    expect(kept).toEqual(base);
    // The disk version survives as a new, marked entry.
    const dup = out.entries.find((e) => e.id === out.duplicatedEntryId);
    expect(dup).toBeDefined();
    expect(dup!.content).toContain('Merged copy from another device');
    expect(out.entries).toHaveLength(2);
  });

  it('does not duplicate when the edited note was deleted on disk', () => {
    const base = entry('a', doc('my edit'));
    const out = mergeDiskState([tl], [entry('b', doc('other'))], base);
    expect(out.duplicatedEntryId).toBeNull();
    expect(out.entries).toHaveLength(1);
  });
});

describe('mergeForeignState', () => {
  it('imports a brand-new note and counts it', () => {
    const out = mergeForeignState([tl], [entry('a', doc('a'))], [tl], [entry('b', doc('b'))]);
    expect(out.entries.map((e) => e.id).sort()).toEqual(['a', 'b']);
    expect(out.importedCount).toBe(1);
    expect(out.conflictCount).toBe(0);
  });

  it('skips an incoming note whose content is identical', () => {
    const out = mergeForeignState([tl], [entry('a', doc('same'))], [tl], [entry('a', doc('same'))]);
    expect(out.entries).toHaveLength(1);
    expect(out.importedCount).toBe(0);
    expect(out.conflictCount).toBe(0);
  });

  it('keeps both versions when the same id has different content', () => {
    const out = mergeForeignState([tl], [entry('a', doc('mine'))], [tl], [entry('a', doc('theirs'))]);
    expect(out.entries).toHaveLength(2);
    const original = out.entries.find((e) => e.id === 'a')!;
    expect(original.content).toBe(doc('mine'));
    const dup = out.entries.find((e) => e.id !== 'a')!;
    expect(dup.content).toContain('Merged copy from another device');
    expect(dup.content).toContain('theirs');
    expect(out.importedCount).toBe(1);
    expect(out.conflictCount).toBe(1);
  });

  it('adds a missing timeline so imported notes are not orphaned', () => {
    const incomingTl: Timeline = { id: 't2', name: 'T2', createdAt: '2026-01-01T00:00:00Z', tags: [] };
    const out = mergeForeignState([tl], [], [incomingTl], [{ ...entry('x', doc('x')), timelineId: 't2' }]);
    expect(out.timelines.map((t) => t.id).sort()).toEqual(['t1', 't2']);
    expect(out.entries.map((e) => e.id)).toEqual(['x']);
  });

  it('keeps the timeline with the later updatedAt on a conflict', () => {
    const current: Timeline = { ...tl, name: 'old', updatedAt: '2026-01-01T00:00:00Z' };
    const incoming: Timeline = { ...tl, name: 'new', updatedAt: '2026-02-01T00:00:00Z' };
    const out = mergeForeignState([current], [], [incoming], []);
    expect(out.timelines).toHaveLength(1);
    expect(out.timelines[0].name).toBe('new');
  });

  it('does not overwrite an existing timeline with an older incoming one', () => {
    const current: Timeline = { ...tl, name: 'new', updatedAt: '2026-02-01T00:00:00Z' };
    const incoming: Timeline = { ...tl, name: 'old', updatedAt: '2026-01-01T00:00:00Z' };
    const out = mergeForeignState([current], [], [incoming], []);
    expect(out.timelines[0].name).toBe('new');
  });
});

describe('markMergedCopy', () => {
  it('prepends a marker paragraph to valid TipTap JSON', () => {
    const marked = JSON.parse(markMergedCopy(doc('hello')));
    expect(marked.content[0].content[0].text).toContain('Merged copy from another device');
    expect(marked.content[1].content[0].text).toBe('hello');
  });

  it('returns the input unchanged when content is not JSON', () => {
    expect(markMergedCopy('not json')).toBe('not json');
  });
});

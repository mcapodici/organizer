import { describe, it, expect } from 'vitest';
import { mergeDiskState, markMergedCopy } from './merge';
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

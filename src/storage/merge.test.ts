import { describe, it, expect } from 'vitest';
import { markMergedCopy } from './merge';

const doc = (text: string) => JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });

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

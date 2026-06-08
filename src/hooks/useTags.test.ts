import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTags } from './useTags';
import type { Timeline } from '../types';

const tl = (id: string, tags: string[]): Timeline => ({
  id, name: id, createdAt: '2026-01-01T00:00:00Z', tags,
});

describe('useTags', () => {
  it('returns an empty array when there are no timelines', () => {
    const { result } = renderHook(() => useTags([]));
    expect(result.current).toEqual([]);
  });

  it('collects a sorted, de-duplicated set of tags across timelines', () => {
    const timelines = [tl('a', ['work', 'urgent']), tl('b', ['urgent', 'home']), tl('c', [])];
    const { result } = renderHook(() => useTags(timelines));
    expect(result.current).toEqual(['home', 'urgent', 'work']);
  });

  it('returns the same memoized reference when the input array is unchanged', () => {
    const timelines = [tl('a', ['x'])];
    const { result, rerender } = renderHook(({ t }) => useTags(t), {
      initialProps: { t: timelines },
    });
    const first = result.current;
    rerender({ t: timelines });
    expect(result.current).toBe(first);
  });
});

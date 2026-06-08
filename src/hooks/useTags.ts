import { useMemo } from 'react';
import type { Timeline } from '../types';

export function useTags(timelines: Timeline[]): string[] {
  return useMemo(() => {
    const set = new Set<string>();
    for (const t of timelines) for (const tag of t.tags) set.add(tag);
    return Array.from(set).sort();
  }, [timelines]);
}

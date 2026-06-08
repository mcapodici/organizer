import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { FakeAdapter } from '../test-utils/fakeAdapter';
import type { Entry } from '../types';

const h = vi.hoisted(() => ({ adapter: null as unknown as FakeAdapter }));
vi.mock('../context/StorageContext', () => ({
  useStorage: () => ({ adapter: h.adapter }),
}));

import { useTodoCounts } from './useTodoCounts';

const en = (id: string, timelineId: string, over: Partial<Entry> = {}): Entry => ({
  id, timelineId, content: id, timestamp: '2026-01-01T00:00:00Z', attachments: [], isStart: false, ...over,
});

beforeEach(() => { h.adapter = new FakeAdapter(); });

describe('useTodoCounts', () => {
  it('counts only entries with a dueDate that are not done, grouped by timeline', async () => {
    await h.adapter.putEntry(en('a', 't1', { dueDate: '2099-01-01' }));
    await h.adapter.putEntry(en('b', 't1', { dueDate: '2099-02-01' }));
    await h.adapter.putEntry(en('done', 't1', { dueDate: '2099-01-01', isDone: true }));
    await h.adapter.putEntry(en('noDue', 't1'));
    await h.adapter.putEntry(en('c', 't2', { dueDate: '2099-01-01' }));

    const { result } = renderHook(() => useTodoCounts());
    await waitFor(() => expect(Object.keys(result.current.todoCounts)).toHaveLength(2));
    expect(result.current.todoCounts['t1'].count).toBe(2);
    expect(result.current.todoCounts['t2'].count).toBe(1);
  });

  it('marks past-due items as overdue and future items as not overdue', async () => {
    await h.adapter.putEntry(en('past', 't1', { dueDate: '2000-01-01' }));
    await h.adapter.putEntry(en('future', 't1', { dueDate: '2099-01-01' }));

    const { result } = renderHook(() => useTodoCounts());
    await waitFor(() => expect(result.current.todoCounts['t1']?.count).toBe(2));
    expect(result.current.todoCounts['t1'].overdue).toBe(1);
  });

  it('produces no entries for timelines without todos', async () => {
    await h.adapter.putEntry(en('noDue', 't1'));
    const { result } = renderHook(() => useTodoCounts());
    // give the effect a chance to run
    await waitFor(() => expect(result.current.todoCounts).toEqual({}));
  });

  it('reloadTodoCounts picks up newly-added todos', async () => {
    const { result } = renderHook(() => useTodoCounts());
    await waitFor(() => expect(result.current.todoCounts).toEqual({}));
    await h.adapter.putEntry(en('a', 't1', { dueDate: '2099-01-01' }));
    await act(async () => { await result.current.reloadTodoCounts(); });
    expect(result.current.todoCounts['t1'].count).toBe(1);
  });
});

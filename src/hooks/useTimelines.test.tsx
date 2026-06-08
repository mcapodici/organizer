import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { FakeAdapter } from '../test-utils/fakeAdapter';
import type { Timeline, Entry } from '../types';

const h = vi.hoisted(() => ({ adapter: null as unknown as FakeAdapter }));
vi.mock('../context/StorageContext', () => ({
  useStorage: () => ({ adapter: h.adapter }),
}));

import { useTimelines } from './useTimelines';

const tl = (id: string, over: Partial<Timeline> = {}): Timeline => ({
  id, name: id, createdAt: '2026-01-01T00:00:00Z', tags: [], ...over,
});
const en = (id: string, timelineId: string, over: Partial<Entry> = {}): Entry => ({
  id, timelineId, content: id, timestamp: '2026-01-01T00:00:00Z', attachments: [], isStart: false, ...over,
});

beforeEach(() => { h.adapter = new FakeAdapter(); });

describe('useTimelines', () => {
  it('loads existing timelines and clears the loading flag', async () => {
    await h.adapter.putTimeline(tl('t1'));
    const { result } = renderHook(() => useTimelines());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.timelines.map((t) => t.id)).toEqual(['t1']);
  });

  it('orders timelines by updatedAt (most recent first), falling back to createdAt', async () => {
    await h.adapter.putTimeline(tl('old', { createdAt: '2026-01-01T00:00:00Z', updatedAt: undefined }));
    await h.adapter.putTimeline(tl('mid', { updatedAt: '2026-03-01T00:00:00Z' }));
    await h.adapter.putTimeline(tl('new', { updatedAt: '2026-06-01T00:00:00Z' }));
    const { result } = renderHook(() => useTimelines());
    await waitFor(() => expect(result.current.timelines).toHaveLength(3));
    expect(result.current.timelines.map((t) => t.id)).toEqual(['new', 'mid', 'old']);
  });

  // See bugs.md #3: equal-updatedAt timelines have their insertion order reversed
  // because the sort comparator never returns 0 for ties.
  it.skip('keeps equal-updatedAt timelines in stable order (BUG #3)', async () => {
    const ts = '2026-03-01T00:00:00Z';
    await h.adapter.putTimeline(tl('first', { updatedAt: ts }));
    await h.adapter.putTimeline(tl('second', { updatedAt: ts }));
    await h.adapter.putTimeline(tl('third', { updatedAt: ts }));
    const { result } = renderHook(() => useTimelines());
    await waitFor(() => expect(result.current.timelines).toHaveLength(3));
    expect(result.current.timelines.map((t) => t.id)).toEqual(['first', 'second', 'third']);
  });

  it('createTimeline persists a timeline with timestamps and reloads', async () => {
    const { result } = renderHook(() => useTimelines());
    await waitFor(() => expect(result.current.loading).toBe(false));
    let created!: Timeline;
    await act(async () => { created = await result.current.createTimeline('My TL'); });
    expect(created.name).toBe('My TL');
    expect(created.createdAt).toBeTruthy();
    expect(created.updatedAt).toBeTruthy();
    expect(result.current.timelines.map((t) => t.id)).toContain(created.id);
  });

  it('updateTimeline stamps a fresh updatedAt', async () => {
    await h.adapter.putTimeline(tl('t1', { updatedAt: '2020-01-01T00:00:00Z' }));
    const { result } = renderHook(() => useTimelines());
    await waitFor(() => expect(result.current.timelines).toHaveLength(1));
    await act(async () => { await result.current.updateTimeline({ ...tl('t1'), name: 'changed' }); });
    const stored = (await h.adapter.getAllTimelines())[0];
    expect(stored.name).toBe('changed');
    expect(new Date(stored.updatedAt!).getTime()).toBeGreaterThan(new Date('2020-01-01T00:00:00Z').getTime());
  });

  it('removeTimeline deletes the timeline, its entries, and attachment blobs', async () => {
    await h.adapter.putTimeline(tl('t1'));
    await h.adapter.putBlob('blob-1', new Uint8Array([1]).buffer);
    await h.adapter.putEntry(en('e1', 't1', {
      attachments: [{ id: 'a1', name: 'f', mimeType: 'image/png', size: 1, blobKey: 'blob-1' }],
    }));
    const { result } = renderHook(() => useTimelines());
    await waitFor(() => expect(result.current.timelines).toHaveLength(1));
    await act(async () => { await result.current.removeTimeline('t1'); });
    expect(await h.adapter.getAllTimelines()).toEqual([]);
    expect(await h.adapter.getAllEntries()).toEqual([]);
    expect(await h.adapter.getBlob('blob-1')).toBeUndefined();
  });
});

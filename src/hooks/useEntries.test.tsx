import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { FakeAdapter } from '../test-utils/fakeAdapter';
import type { Entry } from '../types';

const h = vi.hoisted(() => ({
  adapter: null as unknown as FakeAdapter,
  notifyMergedCopy: vi.fn(),
}));
vi.mock('../context/StorageContext', () => ({
  useStorage: () => ({ adapter: h.adapter, notifyMergedCopy: h.notifyMergedCopy }),
}));

import { useEntries } from './useEntries';

const en = (id: string, timelineId: string, over: Partial<Entry> = {}): Entry => ({
  id, timelineId, content: id, timestamp: '2026-01-01T00:00:00Z', attachments: [], isStart: false, ...over,
});

beforeEach(() => { h.adapter = new FakeAdapter(); h.notifyMergedCopy.mockClear(); });

describe('useEntries', () => {
  it('returns an empty list when no timeline is selected', async () => {
    const { result } = renderHook(() => useEntries(null));
    await waitFor(() => expect(result.current.entries).toEqual([]));
  });

  it('loads only the selected timeline\'s entries, sorted by timestamp ascending', async () => {
    await h.adapter.putEntry(en('late', 't1', { timestamp: '2026-06-01T00:00:00Z' }));
    await h.adapter.putEntry(en('early', 't1', { timestamp: '2026-01-01T00:00:00Z' }));
    await h.adapter.putEntry(en('other', 't2', { timestamp: '2026-02-01T00:00:00Z' }));
    const { result } = renderHook(() => useEntries('t1'));
    await waitFor(() => expect(result.current.entries).toHaveLength(2));
    expect(result.current.entries.map((e) => e.id)).toEqual(['early', 'late']);
  });

  // Same-timestamp entries must keep their insertion order (stable sort), not be
  // reversed by a comparator that never returns 0 for ties.
  it('keeps equal-timestamp entries in stable order', async () => {
    await h.adapter.putEntry(en('first', 't1', { timestamp: '2026-01-01T00:00:00Z' }));
    await h.adapter.putEntry(en('second', 't1', { timestamp: '2026-01-01T00:00:00Z' }));
    await h.adapter.putEntry(en('third', 't1', { timestamp: '2026-01-01T00:00:00Z' }));
    const { result } = renderHook(() => useEntries('t1'));
    await waitFor(() => expect(result.current.entries).toHaveLength(3));
    expect(result.current.entries.map((e) => e.id)).toEqual(['first', 'second', 'third']);
  });

  it('addEntry fills in id/timelineId/isStart and reloads', async () => {
    const { result } = renderHook(() => useEntries('t1'));
    await waitFor(() => expect(result.current.entries).toEqual([]));
    let created!: Entry;
    await act(async () => {
      created = await result.current.addEntry({
        content: 'hello', timestamp: '2026-05-01T00:00:00Z', attachments: [],
      });
    });
    expect(created.id).toBeTruthy();
    expect(created.timelineId).toBe('t1');
    expect(created.isStart).toBe(false);
    expect(result.current.entries.map((e) => e.id)).toEqual([created.id]);
  });

  it('addEntry rejects when no timeline is selected', async () => {
    const { result } = renderHook(() => useEntries(null));
    await waitFor(() => expect(result.current.entries).toEqual([]));
    await expect(
      result.current.addEntry({ content: 'x', timestamp: '2026-01-01T00:00:00Z', attachments: [] }),
    ).rejects.toThrow('No timeline selected');
  });

  it('updateEntry writes the changed entry through to storage', async () => {
    await h.adapter.putEntry(en('e1', 't1', { content: 'before' }));
    const { result } = renderHook(() => useEntries('t1'));
    await waitFor(() => expect(result.current.entries).toHaveLength(1));
    await act(async () => { await result.current.updateEntry(en('e1', 't1', { content: 'after' })); });
    expect(result.current.entries[0].content).toBe('after');
  });

  it('updateEntry with a matching rev leaves one entry and announces nothing', async () => {
    await h.adapter.putEntry(en('e1', 't1', { content: 'before', rev: 'r1' }));
    const { result } = renderHook(() => useEntries('t1'));
    await waitFor(() => expect(result.current.entries).toHaveLength(1));

    await act(async () => {
      await result.current.updateEntry(en('e1', 't1', { content: 'after', rev: 'r1' }));
    });

    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0].content).toBe('after');
    expect(h.notifyMergedCopy).not.toHaveBeenCalled();
  });

  // Another tab saved e1 while this one held it open: keep both, and say so.
  it('updateEntry with a stale rev keeps both versions and announces the copy', async () => {
    await h.adapter.putEntry(en('e1', 't1', { content: 'their edit', rev: 'r2' }));
    const { result } = renderHook(() => useEntries('t1'));
    await waitFor(() => expect(result.current.entries).toHaveLength(1));

    await act(async () => {
      await result.current.updateEntry(en('e1', 't1', { content: 'my edit', rev: 'r1' }));
    });

    expect(result.current.entries).toHaveLength(2);
    expect(result.current.entries.find((e) => e.id === 'e1')?.content).toBe('my edit');
    const dup = result.current.entries.find((e) => e.id !== 'e1')!;
    expect(dup.content).toContain('their edit');
    expect(h.notifyMergedCopy).toHaveBeenCalledTimes(1);
  });

  it('removeEntry deletes the entry and all its attachment blobs', async () => {
    await h.adapter.putBlob('b1', new Uint8Array([1]).buffer);
    await h.adapter.putBlob('b2', new Uint8Array([2]).buffer);
    const entry = en('e1', 't1', {
      attachments: [
        { id: 'a1', name: 'one', mimeType: 'image/png', size: 1, blobKey: 'b1' },
        { id: 'a2', name: 'two', mimeType: 'image/png', size: 1, blobKey: 'b2' },
      ],
    });
    await h.adapter.putEntry(entry);
    const { result } = renderHook(() => useEntries('t1'));
    await waitFor(() => expect(result.current.entries).toHaveLength(1));
    await act(async () => { await result.current.removeEntry(entry); });
    expect(result.current.entries).toEqual([]);
    expect(await h.adapter.getBlob('b1')).toBeUndefined();
    expect(await h.adapter.getBlob('b2')).toBeUndefined();
  });
});

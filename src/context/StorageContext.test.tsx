import { useState, useEffect } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import { StorageProvider, useStorage } from './StorageContext';
import { IdbAdapter } from '../storage/idbAdapter';
import { createChangeChannel, type ChangeChannel } from '../storage/changeChannel';
import { resetDB } from '../db/schema';
import type { Entry } from '../types';

const en = (id: string): Entry => ({
  id, timelineId: 't1', content: id, timestamp: '2026-01-01T00:00:00Z', attachments: [], isStart: false,
});

// A probe child that re-reads through the context adapter whenever the provider
// hands it a new adapter object — the same mechanism useEntries/useTimelines use.
function EntryCount() {
  const { adapter } = useStorage();
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    let live = true;
    adapter.getAllEntries().then((all) => { if (live) setCount(all.length); });
    return () => { live = false; };
  }, [adapter]);
  return <div data-testid="count">{count === null ? '…' : String(count)}</div>;
}

let channels: ChangeChannel[] = [];
function openChannel(): ChangeChannel {
  const c = createChangeChannel();
  channels.push(c);
  return c;
}

beforeEach(() => {
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  resetDB();
  localStorage.clear();
  // No storage.getDirectory, so boot takes the IndexedDB branch.
  vi.stubGlobal('navigator', {});
});

afterEach(() => {
  for (const c of channels) c.close();
  channels = [];
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function renderProvider() {
  render(
    <StorageProvider>
      <EntryCount />
    </StorageProvider>,
  );
  await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('0'));
}

describe('StorageProvider — cross-tab refresh', () => {
  it('re-reads the store when another tab posts on the channel', async () => {
    await renderProvider();

    // Another tab writes, then announces it.
    const other = new IdbAdapter();
    await other.putEntry(en('e1'));
    await act(async () => {
      openChannel().post();
      // Let the BroadcastChannel message and the refresh promise settle.
      await new Promise((r) => setTimeout(r, 0));
    });

    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('1'));
  });

  it('re-reads the store when the tab becomes visible again', async () => {
    await renderProvider();

    const other = new IdbAdapter();
    await other.putEntry(en('e1'));
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();
    });

    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('1'));
  });

  // The old design polled every 2s. Nothing should reload on a timer now.
  it('does not reload on a timer', async () => {
    await renderProvider();

    const other = new IdbAdapter();
    await other.putEntry(en('e1'));

    vi.useFakeTimers();
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    vi.useRealTimers();

    expect(screen.getByTestId('count').textContent).toBe('0');
  });
});

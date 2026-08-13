import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { FakeAdapter } from '../test-utils/fakeAdapter';

// The provider constructs its adapter directly (`new OpfsAdapter()` /
// `new IdbAdapter()`), so we intercept both constructors and hand back one
// shared FakeAdapter we can steer (conflict flag, merge result). A constructor
// that returns an object uses that object as the instance, whichever backend
// boot selects.
const h = vi.hoisted(() => ({ adapter: null as unknown as FakeAdapter }));
vi.mock('../storage/opfsAdapter', () => ({
  OpfsAdapter: class { constructor() { return h.adapter; } },
}));
vi.mock('../storage/idbAdapter', () => ({
  IdbAdapter: class { constructor() { return h.adapter; } },
}));

import { StorageProvider, useStorage } from './StorageContext';

// Fake timers drive the 2s auto-merge poll deterministically. The shared-process
// run means the afterEach restore keeps the clock out of every other file.
beforeEach(() => { h.adapter = new FakeAdapter(); vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

function Probe() {
  const { adapter } = useStorage();
  return <div>adapter:{adapter ? 'ready' : 'none'}</div>;
}

async function renderProvider() {
  await act(async () => {
    render(
      <StorageProvider>
        <Probe />
      </StorageProvider>,
    );
  });
}

describe('StorageProvider', () => {
  it('boots an adapter and exposes it to consumers past the loading screen', async () => {
    await renderProvider();
    expect(screen.queryByText('Loading…')).toBeNull();
    expect(screen.getByText('adapter:ready')).toBeTruthy();
  });

  it('merges and toasts on a poll tick when the adapter reports a conflict', async () => {
    h.adapter.conflict = true;
    h.adapter.mergeResult = { importedCount: 2 };
    const mergeSpy = vi.spyOn(h.adapter, 'mergeFromDisk');
    await renderProvider();

    // Nothing merges until the poll fires.
    expect(mergeSpy).not.toHaveBeenCalled();

    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });

    expect(mergeSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Merged 2 notes from another device')).toBeTruthy();
  });

  it('does not toast when a poll tick finds no conflict', async () => {
    h.adapter.conflict = false;
    await renderProvider();

    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });

    expect(screen.queryByText(/Merged/)).toBeNull();
  });
});

describe('useStorage', () => {
  it('throws outside a provider', () => {
    function Bare() {
      useStorage();
      return null;
    }
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Bare />)).toThrow('useStorage must be inside StorageProvider');
    spy.mockRestore();
  });
});

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { UndoProvider, useUndo, UNDO_WINDOW_MS } from './UndoContext';

// The only suite in the repo that installs fake timers. `vitest run
// --no-file-parallelism` with pool: 'threads' shares one process, so the
// afterEach restore below is what keeps the clock out of every other file.
beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

function Probe({ first, second }: { first: () => void; second?: () => void }) {
  const { registerUndo } = useUndo();
  return (
    <>
      <button onClick={() => registerUndo('Marked done', first)}>register first</button>
      {second && (
        <button onClick={() => registerUndo('Due date removed', second)}>register second</button>
      )}
    </>
  );
}

function renderProbe(first: () => void, second?: () => void) {
  return render(
    <UndoProvider>
      <Probe first={first} second={second} />
    </UndoProvider>,
  );
}

async function click(name: string) {
  await act(async () => { fireEvent.click(screen.getByText(name)); });
}

async function advance(ms: number) {
  await act(async () => { vi.advanceTimersByTime(ms); });
}

describe('UndoProvider', () => {
  it('shows the label and an Undo button once a change is registered', async () => {
    renderProbe(() => {});
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();

    await click('register first');

    expect(screen.getByText('Marked done')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeTruthy();
  });

  it('runs the callback exactly once and hides the bar', async () => {
    const first = vi.fn();
    renderProbe(first);
    await click('register first');

    await click('Undo');

    expect(first).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
  });

  it('hides the bar without running the callback once the window elapses', async () => {
    const first = vi.fn();
    renderProbe(first);
    await click('register first');

    await advance(UNDO_WINDOW_MS);

    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
    expect(first).not.toHaveBeenCalled();
  });

  it('dismissing drops the undo without running it', async () => {
    const first = vi.fn();
    renderProbe(first);
    await click('register first');

    await act(async () => { fireEvent.click(screen.getByLabelText('Dismiss')); });

    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
    expect(first).not.toHaveBeenCalled();
  });

  it('lets a second change supersede the first, which stays committed', async () => {
    const first = vi.fn();
    const second = vi.fn();
    renderProbe(first, second);
    await click('register first');
    await advance(4000);
    await click('register second');

    expect(screen.getByText('Due date removed')).toBeTruthy();
    expect(screen.queryByText('Marked done')).toBeNull();

    // The first window's original deadline passes without hiding the bar.
    await advance(6000);
    expect(screen.getByRole('button', { name: 'Undo' })).toBeTruthy();

    await click('Undo');
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
  });

  it('gives the second change a full fresh window', async () => {
    renderProbe(() => {}, () => {});
    await click('register first');
    await advance(9000);
    await click('register second');

    expect(screen.getByText('10s')).toBeTruthy();

    await advance(UNDO_WINDOW_MS - 1000);
    expect(screen.getByRole('button', { name: 'Undo' })).toBeTruthy();
    await advance(1000);
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
  });

  it('counts the remaining seconds down', async () => {
    renderProbe(() => {});
    await click('register first');
    expect(screen.getByText('10s')).toBeTruthy();

    await advance(3000);
    expect(screen.getByText('7s')).toBeTruthy();

    await advance(4000);
    expect(screen.getByText('3s')).toBeTruthy();
  });
});

describe('useUndo', () => {
  it('throws outside a provider', () => {
    function Bare() {
      useUndo();
      return null;
    }
    // React logs the thrown error; silence it so the run stays readable.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Bare />)).toThrow('useUndo must be inside UndoProvider');
    spy.mockRestore();
  });
});

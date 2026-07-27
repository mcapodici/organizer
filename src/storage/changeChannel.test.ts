import { describe, it, expect, afterEach, vi } from 'vitest';
import { createChangeChannel, type ChangeChannel } from './changeChannel';

// Node's BroadcastChannel is process-wide and vitest runs `pool: 'threads'`, so
// every case gets its own channel name and everything opened is closed after.
let opened: ChangeChannel[] = [];
function open(name: string): ChangeChannel {
  const c = createChangeChannel(name);
  opened.push(c);
  return c;
}

afterEach(() => {
  for (const c of opened) c.close();
  opened = [];
  vi.unstubAllGlobals();
});

// A posted message is delivered on a macrotask, so wait a tick before asserting.
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('createChangeChannel', () => {
  it('delivers a post to another channel of the same name', async () => {
    const writer = open('test-deliver');
    const reader = open('test-deliver');
    const seen = vi.fn();
    reader.subscribe(seen);

    writer.post();
    await flush();

    expect(seen).toHaveBeenCalledTimes(1);
  });

  it('stops delivery after unsubscribe', async () => {
    const writer = open('test-unsubscribe');
    const reader = open('test-unsubscribe');
    const seen = vi.fn();
    const unsubscribe = reader.subscribe(seen);

    unsubscribe();
    writer.post();
    await flush();

    expect(seen).not.toHaveBeenCalled();
  });

  it('is safe to close twice', () => {
    const c = open('test-double-close');
    c.close();
    expect(() => c.close()).not.toThrow();
  });

  it('degrades to a no-op where BroadcastChannel is unavailable', async () => {
    vi.stubGlobal('BroadcastChannel', undefined);
    const c = createChangeChannel('test-unsupported');
    const seen = vi.fn();
    const unsubscribe = c.subscribe(seen);

    expect(() => c.post()).not.toThrow();
    await flush();
    expect(seen).not.toHaveBeenCalled();
    expect(() => { unsubscribe(); c.close(); }).not.toThrow();
  });
});

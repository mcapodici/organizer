export interface ChangeChannel {
  /** Tell the other tabs that this one just wrote to the store. */
  post(): void;
  /** Run `fn` whenever another tab posts. Returns an unsubscribe function. */
  subscribe(fn: () => void): () => void;
  close(): void;
}

// A one-message-type BroadcastChannel: "the store changed". The payload carries
// nothing — a listening tab responds by re-reading the store, which is cheaper
// to reason about than shipping diffs between tabs.
//
// The underlying BroadcastChannel is opened lazily and re-opened after close(),
// so the handle stays usable for the life of the provider that owns it (React
// mounts effects twice in development, closing it in between).
//
// `name` is parameterised so tests can isolate cases; production always uses the
// default. Degrades to a no-op where BroadcastChannel is unavailable — the tab
// then only catches up on focus/visibilitychange.
export function createChangeChannel(name = 'organizer-store'): ChangeChannel {
  if (typeof BroadcastChannel !== 'function') {
    return { post() {}, subscribe() { return () => {}; }, close() {} };
  }

  const listeners = new Set<() => void>();
  let channel: BroadcastChannel | null = null;

  function open(): BroadcastChannel {
    if (!channel) {
      channel = new BroadcastChannel(name);
      channel.addEventListener('message', () => {
        for (const fn of [...listeners]) fn();
      });
    }
    return channel;
  }

  return {
    post() { open().postMessage('changed'); },
    subscribe(fn) {
      listeners.add(fn);
      open();
      return () => { listeners.delete(fn); };
    },
    close() {
      channel?.close();
      channel = null;
    },
  };
}

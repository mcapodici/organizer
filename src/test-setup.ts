import 'fake-indexeddb/auto';

// ---------------------------------------------------------------------------
// Web Storage shim for Node 26+
//
// Node 26 exposes the built-in Web Storage API as a global, so `localStorage`
// is an own property of `globalThis` before jsdom ever loads — and its getter
// returns `undefined` unless the process was started with `--localstorage-file`.
// (Verified: 22.23.2 and 24.19.0 are unaffected, 26.7.0 is affected.)
//
// Vitest builds its jsdom global with `populateGlobal`, which skips any key
// already present on the global object unless that key is in its own allow-list.
// `localStorage` is not on that list, so Node's inert property survives and
// jsdom's real Storage is never installed. `window.localStorage` is undefined
// too, because Vitest sets `global.window = global`.
//
// The result is `TypeError: Cannot read properties of undefined` the first time
// a test touches storage. jsdom itself is fine — this is purely a collision
// between Node's global and Vitest's copy step.
//
// So: if the global is missing or inert, install a working in-memory Storage.
// Where jsdom's own Storage survives (Node 22, 24) this is a no-op.
// ---------------------------------------------------------------------------

function createStorage(): Storage {
  const entries = new Map<string, string>();
  const storage = {
    get length() {
      return entries.size;
    },
    key(index: number): string | null {
      return Array.from(entries.keys())[index] ?? null;
    },
    getItem(key: string): string | null {
      const value = entries.get(String(key));
      return value === undefined ? null : value;
    },
    setItem(key: string, value: string): void {
      entries.set(String(key), String(value));
    },
    removeItem(key: string): void {
      entries.delete(String(key));
    },
    clear(): void {
      entries.clear();
    },
  };
  return storage as Storage;
}

function installStorage(name: 'localStorage' | 'sessionStorage'): void {
  // Reading the property is what exposes Node's inert getter, so probe it
  // rather than trusting that the key is absent.
  let existing: unknown;
  try {
    existing = (globalThis as Record<string, unknown>)[name];
  } catch {
    existing = undefined;
  }
  if (existing) return;

  Object.defineProperty(globalThis, name, {
    value: createStorage(),
    writable: true,
    enumerable: true,
    configurable: true,
  });
}

installStorage('localStorage');
installStorage('sessionStorage');

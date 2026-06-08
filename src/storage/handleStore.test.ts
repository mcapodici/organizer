import { describe, it, expect, beforeEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { saveHandle, loadHandle } from './handleStore';

// handleStore persists a directory handle in its own IndexedDB database. We can't
// produce a real FileSystemDirectoryHandle in jsdom, but IndexedDB stores arbitrary
// structured-cloneable values, so a plain stand-in object round-trips fine and lets
// us verify the save/load wiring and key.

beforeEach(() => {
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
});

describe('handleStore', () => {
  it('returns undefined before anything is saved', async () => {
    expect(await loadHandle()).toBeUndefined();
  });

  it('round-trips a saved handle', async () => {
    const fakeHandle = { name: 'my-folder', kind: 'directory' } as unknown as FileSystemDirectoryHandle;
    await saveHandle(fakeHandle);
    const loaded = await loadHandle();
    expect(loaded).toMatchObject({ name: 'my-folder', kind: 'directory' });
  });

  it('overwrites the previously saved handle', async () => {
    await saveHandle({ name: 'first' } as unknown as FileSystemDirectoryHandle);
    await saveHandle({ name: 'second' } as unknown as FileSystemDirectoryHandle);
    expect(await loadHandle()).toMatchObject({ name: 'second' });
  });
});

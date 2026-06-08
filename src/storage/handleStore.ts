import { openDB } from 'idb';

async function getHandleDB() {
  return openDB('workspace-handles', 1, {
    upgrade(d) { d.createObjectStore('handles'); },
  });
}

export async function saveHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  await (await getHandleDB()).put('handles', handle, 'dir');
}

export async function loadHandle(): Promise<FileSystemDirectoryHandle | undefined> {
  return (await getHandleDB()).get('handles', 'dir');
}

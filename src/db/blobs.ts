import { getDB } from './schema';

export async function getBlob(blobKey: string): Promise<ArrayBuffer | undefined> {
  return (await getDB()).get('blobs', blobKey);
}

export async function putBlob(blobKey: string, data: ArrayBuffer): Promise<void> {
  await (await getDB()).put('blobs', data, blobKey);
}

export async function deleteBlob(blobKey: string): Promise<void> {
  await (await getDB()).delete('blobs', blobKey);
}

export async function getAllBlobKeys(): Promise<string[]> {
  return (await getDB()).getAllKeys('blobs') as Promise<string[]>;
}

export async function getAllBlobs(): Promise<Record<string, ArrayBuffer>> {
  const d = await getDB();
  const keys = (await d.getAllKeys('blobs')) as string[];
  const values = await d.getAll('blobs');
  const result: Record<string, ArrayBuffer> = {};
  keys.forEach((k, i) => { result[k] = values[i]; });
  return result;
}

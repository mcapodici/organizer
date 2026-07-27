import type { StorageAdapter } from '../storage/interface';
import type { ExportData } from '../types';

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export async function exportData(adapter: StorageAdapter): Promise<void> {
  const timelines = await adapter.getAllTimelines();
  const entries = await adapter.getAllEntries();
  const blobMap = await adapter.getAllBlobs();

  const blobs: Record<string, string> = {};
  for (const [key, buf] of Object.entries(blobMap)) {
    blobs[key] = arrayBufferToBase64(buf);
  }

  const data: ExportData = { version: 1, timelines, entries, blobs };
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `timelines-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// Wipe every timeline, entry, and attachment. Shared by "Replace all data" on
// import and by Settings → Clear all data.
export async function clearAllData(adapter: StorageAdapter): Promise<void> {
  const existingTimelines = await adapter.getAllTimelines();
  const existingEntries = await adapter.getAllEntries();
  const existingBlobKeys = await adapter.getAllBlobKeys();
  await Promise.all(existingTimelines.map((t) => adapter.deleteTimeline(t.id)));
  await Promise.all(existingEntries.map((e) => adapter.deleteEntry(e.id)));
  // Clear blobs too — a true replace starts from a clean slate, and leaving the
  // old attachment data behind would orphan it (and stray .bin files on disk).
  await Promise.all(existingBlobKeys.map((k) => adapter.deleteBlob(k)));
}

export async function importData(adapter: StorageAdapter, file: File, mode: 'replace' | 'merge'): Promise<void> {
  const text = await file.text();
  const data: ExportData = JSON.parse(text);

  if (mode === 'replace') {
    await clearAllData(adapter);
  }

  const existing = mode === 'merge'
    ? new Set([
        ...(await adapter.getAllTimelines()).map((t) => t.id),
        ...(await adapter.getAllEntries()).map((e) => e.id),
      ])
    : new Set<string>();

  for (const timeline of data.timelines) {
    if (!existing.has(timeline.id)) await adapter.putTimeline(timeline);
  }
  for (const entry of data.entries) {
    if (!existing.has(entry.id)) await adapter.putEntry(entry);
  }
  for (const [key, b64] of Object.entries(data.blobs || {})) {
    await adapter.putBlob(key, base64ToArrayBuffer(b64));
  }
}

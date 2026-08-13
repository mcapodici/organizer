import { z } from 'zod';
import type { StorageAdapter } from '../storage/interface';
import type { ExportData } from '../types';

const attachmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  mimeType: z.string(),
  size: z.number(),
  blobKey: z.string(),
});

const timelineSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
  tags: z.array(z.string()),
});

const entrySchema = z.object({
  id: z.string(),
  timelineId: z.string(),
  content: z.string(),
  timestamp: z.string(),
  attachments: z.array(attachmentSchema),
  isStart: z.boolean(),
  dueDate: z.string().optional(),
  isDone: z.boolean().optional(),
});

const exportDataSchema = z.object({
  version: z.number(),
  timelines: z.array(timelineSchema).default([]),
  entries: z.array(entrySchema).default([]),
  blobs: z.record(z.string(), z.string()).optional(),
});

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

// The one export format this app writes and understands. Bump when the on-disk
// shape changes; refuse anything newer so a future export can't be silently
// half-imported by an older build.
const SUPPORTED_VERSION = 1;

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

export async function importData(adapter: StorageAdapter, file: File, mode: 'replace' | 'merge'): Promise<void> {
  const text = await file.text();

  // Validate the untrusted file BEFORE any destructive write. Import is the one
  // channel where outside data enters this local-first app: a malformed file
  // must not crash mid-loop (which, in replace mode, would leave storage
  // half-wiped) nor smuggle unexpected fields into storage.
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Import failed: the selected file is not valid JSON.');
  }
  const result = exportDataSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error('Import failed: the file is not a valid Organizer export.');
  }
  const data = result.data;

  if (data.version > SUPPORTED_VERSION) {
    throw new Error(
      `Import failed: this file was created by a newer version (format ${data.version}); please update Organizer.`,
    );
  }

  if (mode === 'replace') {
    const existingTimelines = await adapter.getAllTimelines();
    const existingEntries = await adapter.getAllEntries();
    const existingBlobKeys = await adapter.getAllBlobKeys();
    await Promise.all(existingTimelines.map((t) => adapter.deleteTimeline(t.id)));
    await Promise.all(existingEntries.map((e) => adapter.deleteEntry(e.id)));
    // Clear blobs too — a true replace starts from a clean slate, and leaving the
    // old attachment data behind would orphan it (and stray .bin files on disk).
    await Promise.all(existingBlobKeys.map((k) => adapter.deleteBlob(k)));
  }

  const existing = mode === 'merge'
    ? new Set([
        ...(await adapter.getAllTimelines()).map((t) => t.id),
        ...(await adapter.getAllEntries()).map((e) => e.id),
      ])
    : new Set<string>();

  // In merge mode, existing blobs must not be clobbered: a colliding key belongs
  // to a local entry we keep, so its bytes win just like its timeline/entry do.
  const existingBlobKeys = mode === 'merge'
    ? new Set(await adapter.getAllBlobKeys())
    : new Set<string>();

  for (const timeline of data.timelines) {
    if (!existing.has(timeline.id)) await adapter.putTimeline(timeline);
  }
  for (const entry of data.entries) {
    if (!existing.has(entry.id)) await adapter.putEntry(entry);
  }
  for (const [key, b64] of Object.entries(data.blobs || {})) {
    if (existingBlobKeys.has(key)) continue;
    await adapter.putBlob(key, base64ToArrayBuffer(b64));
  }
}

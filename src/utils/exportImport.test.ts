import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { exportData, importData } from './exportImport';
import { FakeAdapter } from '../test-utils/fakeAdapter';
import type { Timeline, Entry, ExportData } from '../types';

const tl = (id: string, over: Partial<Timeline> = {}): Timeline => ({
  id, name: id, createdAt: '2026-01-01T00:00:00Z', tags: [], ...over,
});
const en = (id: string, timelineId: string, over: Partial<Entry> = {}): Entry => ({
  id, timelineId, content: `c-${id}`, timestamp: '2026-01-01T00:00:00Z',
  attachments: [], isStart: false, ...over,
});

function bytes(...vals: number[]): ArrayBuffer {
  return new Uint8Array(vals).buffer;
}

describe('exportData', () => {
  let captured: Blob | null;

  beforeEach(() => {
    captured = null;
    // jsdom does not implement object URLs; stub them and capture the blob.
    (URL as unknown as { createObjectURL: (b: Blob) => string }).createObjectURL = (b: Blob) => {
      captured = b;
      return 'blob:mock';
    };
    (URL as unknown as { revokeObjectURL: (u: string) => void }).revokeObjectURL = () => {};
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('serializes timelines, entries, and base64-encoded blobs', async () => {
    const a = new FakeAdapter();
    await a.putTimeline(tl('t1'));
    await a.putEntry(en('e1', 't1'));
    await a.putBlob('blob-1', bytes(1, 2, 3, 255));

    await exportData(a);

    expect(captured).not.toBeNull();
    const parsed = JSON.parse(await captured!.text()) as ExportData;
    expect(parsed.version).toBe(1);
    expect(parsed.timelines).toHaveLength(1);
    expect(parsed.entries).toHaveLength(1);
    // btoa of bytes [1,2,3,255]
    expect(parsed.blobs['blob-1']).toBe(btoa(String.fromCharCode(1, 2, 3, 255)));
  });

  it('produces an empty-but-valid payload when there is no data', async () => {
    const a = new FakeAdapter();
    await exportData(a);
    const parsed = JSON.parse(await captured!.text()) as ExportData;
    expect(parsed).toEqual({ version: 1, timelines: [], entries: [], blobs: {} });
  });
});

function makeFile(data: ExportData): File {
  return new File([JSON.stringify(data)], 'backup.json', { type: 'application/json' });
}

describe('importData — replace mode', () => {
  it('clears existing timelines/entries and loads the imported set', async () => {
    const a = new FakeAdapter();
    await a.putTimeline(tl('old'));
    await a.putEntry(en('oldE', 'old'));

    const payload: ExportData = {
      version: 1,
      timelines: [tl('new')],
      entries: [en('newE', 'new')],
      blobs: { k: btoa('hi') },
    };
    await importData(a, makeFile(payload), 'replace');

    expect((await a.getAllTimelines()).map((t) => t.id)).toEqual(['new']);
    expect((await a.getAllEntries()).map((e) => e.id)).toEqual(['newE']);
    expect(await a.getBlob('k')).toBeDefined();
  });

  // See bugs.md #2: replace mode deletes timelines/entries but never the blobs,
  // leaving orphaned attachment data behind.
  it.skip('replace mode should not leave orphaned blobs behind (BUG #2)', async () => {
    const a = new FakeAdapter();
    await a.putBlob('stale', bytes(9, 9, 9)); // belongs to old, soon-deleted data

    const payload: ExportData = {
      version: 1, timelines: [tl('new')], entries: [en('newE', 'new')], blobs: {},
    };
    await importData(a, makeFile(payload), 'replace');

    expect(await a.getBlob('stale')).toBeUndefined();
    expect(await a.getAllBlobKeys()).toEqual([]);
  });

  it('decodes blob payloads back to the original bytes', async () => {
    const a = new FakeAdapter();
    const original = btoa(String.fromCharCode(10, 20, 30));
    const payload: ExportData = {
      version: 1, timelines: [], entries: [], blobs: { b: original },
    };
    await importData(a, makeFile(payload), 'replace');
    const buf = await a.getBlob('b');
    expect(Array.from(new Uint8Array(buf!))).toEqual([10, 20, 30]);
  });
});

describe('importData — merge mode', () => {
  it('keeps existing items and only adds ids that are not already present', async () => {
    const a = new FakeAdapter();
    await a.putTimeline(tl('shared', { name: 'LOCAL' }));
    await a.putEntry(en('localOnly', 'shared'));

    const payload: ExportData = {
      version: 1,
      timelines: [tl('shared', { name: 'IMPORTED' }), tl('fresh')],
      entries: [en('localOnly', 'shared', { content: 'IMPORTED' }), en('importedE', 'fresh')],
      blobs: {},
    };
    await importData(a, makeFile(payload), 'merge');

    const tls = await a.getAllTimelines();
    expect(tls.map((t) => t.id).sort()).toEqual(['fresh', 'shared']);
    // The colliding id is NOT overwritten — local copy wins.
    expect(tls.find((t) => t.id === 'shared')!.name).toBe('LOCAL');

    const entries = await a.getAllEntries();
    expect(entries.map((e) => e.id).sort()).toEqual(['importedE', 'localOnly']);
    expect(entries.find((e) => e.id === 'localOnly')!.content).toBe('c-localOnly');
  });

  it('tolerates a payload with no blobs field', async () => {
    const a = new FakeAdapter();
    const payload = { version: 1, timelines: [tl('t')], entries: [] } as unknown as ExportData;
    await expect(importData(a, makeFile(payload), 'merge')).resolves.toBeUndefined();
    expect(await a.getAllTimelines()).toHaveLength(1);
  });
});

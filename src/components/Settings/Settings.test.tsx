import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { FakeAdapter } from '../../test-utils/fakeAdapter';
import type { Timeline, Entry } from '../../types';

const h = vi.hoisted(() => ({
  adapter: null as unknown as FakeAdapter,
  markSaved: vi.fn(),
  lastSaved: null as string | null,
}));

vi.mock('../../context/StorageContext', () => ({
  useStorage: () => ({ adapter: h.adapter, lastSaved: h.lastSaved, markSaved: h.markSaved }),
}));

const navigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

import { Settings } from './Settings';

const doc = (text: string) =>
  JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });

const tl = (id: string, name: string): Timeline => ({
  id, name, createdAt: '2026-01-01T00:00:00Z', tags: [],
});
const en = (id: string, timelineId: string): Entry => ({
  id, timelineId, content: doc(id), timestamp: '2026-01-01T00:00:00Z', attachments: [], isStart: false,
});

beforeEach(() => {
  h.adapter = new FakeAdapter();
  h.markSaved = vi.fn();
  h.lastSaved = null;
  navigate.mockReset();
});

function renderSettings(onDataChanged = vi.fn()) {
  render(
    <MemoryRouter>
      <Settings onDataChanged={onDataChanged} />
    </MemoryRouter>,
  );
  return onDataChanged;
}

describe('Settings — clear all data', () => {
  it('wipes every timeline, entry, and attachment when confirmed', async () => {
    await h.adapter.putTimeline(tl('t1', 'Tasks'));
    await h.adapter.putEntry(en('e1', 't1'));
    await h.adapter.putBlob('blob-1', new ArrayBuffer(4));
    const onDataChanged = renderSettings();

    fireEvent.click(screen.getByRole('button', { name: /Clear$/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear everything' }));

    await waitFor(() => expect(h.adapter.timelines).toHaveLength(0));
    expect(h.adapter.entries).toHaveLength(0);
    expect(h.adapter.blobs.size).toBe(0);
    expect(onDataChanged).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/', { replace: true });
  });

  it('leaves data untouched when the wipe is cancelled', async () => {
    await h.adapter.putTimeline(tl('t1', 'Tasks'));
    renderSettings();

    fireEvent.click(screen.getByRole('button', { name: /Clear$/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByText('Clear everything')).toBeNull();
    expect(h.adapter.timelines).toHaveLength(1);
  });
});

describe('Settings — export', () => {
  it('marks the data as saved after an export', async () => {
    // jsdom does not implement object URLs; stub them so the download path runs.
    URL.createObjectURL = vi.fn(() => 'blob:mock');
    URL.revokeObjectURL = vi.fn();
    await h.adapter.putTimeline(tl('t1', 'Tasks'));
    renderSettings();

    fireEvent.click(screen.getByRole('button', { name: 'Export' }));

    await waitFor(() => expect(h.markSaved).toHaveBeenCalled());
  });
});

describe('Settings — import', () => {
  function exportFile(): File {
    const payload = {
      version: 1,
      timelines: [tl('imported', 'Imported')],
      entries: [en('ie1', 'imported')],
      blobs: {},
    };
    return new File([JSON.stringify(payload)], 'backup.json', { type: 'application/json' });
  }

  it('replaces existing data when Replace is chosen', async () => {
    await h.adapter.putTimeline(tl('old', 'Old'));
    const onDataChanged = renderSettings();

    fireEvent.change(screen.getByLabelText('Import') as HTMLInputElement, {
      target: { files: [exportFile()] },
    });
    await screen.findByText('backup.json');
    fireEvent.click(screen.getByRole('button', { name: 'Replace all data' }));

    await waitFor(() => expect(h.adapter.timelines.map((t) => t.id)).toEqual(['imported']));
    expect(onDataChanged).toHaveBeenCalled();
  });

  it('merges into existing data when Merge is chosen', async () => {
    await h.adapter.putTimeline(tl('old', 'Old'));
    renderSettings();

    fireEvent.change(screen.getByLabelText('Import') as HTMLInputElement, {
      target: { files: [exportFile()] },
    });
    await screen.findByText('backup.json');
    fireEvent.click(screen.getByRole('button', { name: 'Merge (skip duplicates)' }));

    await waitFor(() => expect(h.adapter.timelines).toHaveLength(2));
    expect(h.adapter.timelines.map((t) => t.id).sort()).toEqual(['imported', 'old']);
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { FakeAdapter } from '../../test-utils/fakeAdapter';
import type { Timeline, Entry } from '../../types';

const h = vi.hoisted(() => ({ adapter: null as unknown as FakeAdapter }));
vi.mock('../../context/StorageContext', () => ({
  useStorage: () => ({ adapter: h.adapter }),
}));

import { SearchBox } from './SearchBox';

const doc = (text: string) =>
  JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });

const tl = (id: string, name: string): Timeline => ({
  id, name, createdAt: '2026-01-01T00:00:00Z', tags: [],
});
const en = (id: string, timelineId: string, content: string, over: Partial<Entry> = {}): Entry => ({
  id, timelineId, content, timestamp: '2026-01-01T00:00:00Z', attachments: [], isStart: false, ...over,
});

const timelines = [tl('t1', 'Project Alpha'), tl('t2', 'Groceries')];

beforeEach(() => {
  h.adapter = new FakeAdapter();
});

function renderSearch() {
  return render(
    <MemoryRouter>
      <SearchBox timelines={timelines} />
    </MemoryRouter>,
  );
}

describe('SearchBox', () => {
  it('matches entries by note text and shows them in the dropdown', async () => {
    await h.adapter.putEntry(en('e1', 't1', doc('The quarterly budget review meeting')));
    await h.adapter.putEntry(en('e2', 't2', doc('Buy milk and eggs')));

    renderSearch();
    const input = screen.getByRole('searchbox');
    await userEvent.click(input); // triggers loadEntries
    await userEvent.type(input, 'budget');

    await waitFor(() => expect(screen.getByText('Project Alpha')).toBeTruthy());
    // The non-matching entry's timeline should not appear.
    expect(screen.queryByText('Groceries')).toBeNull();
  });

  it('matches on the timeline name as well as the note body', async () => {
    await h.adapter.putEntry(en('e1', 't2', doc('weekly run')));
    renderSearch();
    const input = screen.getByRole('searchbox');
    await userEvent.click(input);
    await userEvent.type(input, 'groceries');
    await waitFor(() => expect(screen.getByText('Groceries')).toBeTruthy());
  });

  it('shows no dropdown when nothing matches', async () => {
    await h.adapter.putEntry(en('e1', 't1', doc('hello world')));
    renderSearch();
    const input = screen.getByRole('searchbox');
    await userEvent.click(input);
    // Positive signal: a matching query surfaces the timeline, proving entries
    // have loaded and the search effect has run.
    await userEvent.type(input, 'hello');
    await waitFor(() => expect(screen.getByText('Project Alpha')).toBeTruthy());
    // Now switch to a non-matching query; the result must disappear.
    await userEvent.clear(input);
    await userEvent.type(input, 'zzzznomatch');
    await waitFor(() => expect(screen.queryByText('Project Alpha')).toBeNull());
  });

  it('clears results when the query is emptied', async () => {
    await h.adapter.putEntry(en('e1', 't1', doc('budget review')));
    renderSearch();
    const input = screen.getByRole('searchbox');
    await userEvent.click(input);
    await userEvent.type(input, 'budget');
    await waitFor(() => expect(screen.getByText('Project Alpha')).toBeTruthy());
    await userEvent.clear(input);
    await waitFor(() => expect(screen.queryByText('Project Alpha')).toBeNull());
  });
});

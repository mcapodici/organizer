import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { FakeAdapter } from '../../test-utils/fakeAdapter';
import type { Timeline, Entry } from '../../types';

const h = vi.hoisted(() => ({ adapter: null as unknown as FakeAdapter }));
vi.mock('../../context/StorageContext', () => ({
  useStorage: () => ({ adapter: h.adapter }),
}));

import { TodoPage } from './TodoPage';

const doc = (text: string) =>
  JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });

const tl = (id: string, name: string): Timeline => ({
  id, name, createdAt: '2026-01-01T00:00:00Z', tags: [],
});
const en = (id: string, timelineId: string, over: Partial<Entry> = {}): Entry => ({
  id, timelineId, content: doc(id), timestamp: '2026-01-01T00:00:00Z', attachments: [], isStart: false, ...over,
});

beforeEach(() => { h.adapter = new FakeAdapter(); });

function renderTodos() {
  return render(
    <MemoryRouter>
      <TodoPage onEntryChanged={() => {}} />
    </MemoryRouter>,
  );
}

describe('TodoPage', () => {
  it('shows the empty state when there are no pending todos', async () => {
    await h.adapter.putTimeline(tl('t1', 'Tasks'));
    await h.adapter.putEntry(en('e1', 't1')); // no dueDate → not a todo
    renderTodos();
    await waitFor(() => expect(screen.getByText('All caught up!')).toBeTruthy());
  });

  it('places a long-past due item under Overdue and a far-future one under Due Later', async () => {
    await h.adapter.putTimeline(tl('t1', 'Tasks'));
    await h.adapter.putEntry(en('past', 't1', { dueDate: '2000-01-01' }));
    await h.adapter.putEntry(en('future', 't1', { dueDate: '2099-12-31' }));
    renderTodos();
    await waitFor(() => expect(screen.getByText('Overdue')).toBeTruthy());
    expect(screen.getByText('Due Later')).toBeTruthy();
  });

  it('excludes entries already marked done', async () => {
    await h.adapter.putTimeline(tl('t1', 'Tasks'));
    await h.adapter.putEntry(en('done', 't1', { dueDate: '2000-01-01', isDone: true }));
    renderTodos();
    await waitFor(() => expect(screen.getByText('All caught up!')).toBeTruthy());
    expect(screen.queryByText('Overdue')).toBeNull();
  });

  it('renders the entry text preview and its timeline chip', async () => {
    await h.adapter.putTimeline(tl('t1', 'Tasks'));
    await h.adapter.putEntry({ ...en('e1', 't1', { dueDate: '2000-01-01' }), content: doc('Call the dentist') });
    renderTodos();
    await waitFor(() => expect(screen.getByText('Call the dentist')).toBeTruthy());
    expect(screen.getByText('Tasks')).toBeTruthy();
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { FakeAdapter } from './test-utils/fakeAdapter';
import { WELCOME_KEY } from './utils/welcome';
import type { Timeline } from './types';

const h = vi.hoisted(() => ({ adapter: null as unknown as FakeAdapter }));
// One mock covers every consumer of the hook: useTimelines, useEntries,
// useTags, useTodoCounts, SearchBox and TodoPage all read the same context.
vi.mock('./context/StorageContext', () => ({
  useStorage: () => ({
    adapter: h.adapter,
    lastSaved: null,
    markSaved: () => {},
    registerActiveEdit: () => {},
  }),
}));

import App from './App';

const tl = (id: string, name: string): Timeline => ({
  id, name, createdAt: '2026-01-01T00:00:00Z', tags: [],
});

beforeEach(async () => {
  h.adapter = new FakeAdapter();
  // jsdom has no matchMedia; App reads it in a useState initializer.
  vi.stubGlobal('matchMedia', () => ({
    matches: true,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  // Both guards are needed to keep the welcome-seed effect from navigating
  // away from "/": it only runs with zero timelines and no WELCOME_KEY.
  await h.adapter.putTimeline(tl('t1', 'Tasks'));
  localStorage.setItem(WELCOME_KEY, '1');
});

async function renderHome() {
  render(
    <MemoryRouter initialEntries={['/']}>
      <App />
    </MemoryRouter>,
  );
  await waitFor(() => expect(screen.getByText('No timeline selected')).toBeTruthy());
}

describe('App home empty state', () => {
  it('shows a Todos button next to the New Timeline button', async () => {
    await renderHome();
    expect(screen.getByRole('button', { name: /view todos/i })).toBeTruthy();
  });

  it('places the Todos button after the New Timeline button', async () => {
    await renderHome();
    // Scope to the empty state — the sidebar renders its own New Timeline control.
    const emptyInner = screen.getByText('No timeline selected').parentElement!;
    const buttons = within(emptyInner).getAllByRole('button');
    const newTimeline = within(emptyInner).getByRole('button', { name: /new timeline/i });
    const viewTodos = within(emptyInner).getByRole('button', { name: /view todos/i });
    expect(buttons.indexOf(newTimeline)).toBeLessThan(buttons.indexOf(viewTodos));
  });

  it('navigates to the Todos page when clicked', async () => {
    await renderHome();
    await userEvent.click(screen.getByRole('button', { name: /view todos/i }));
    // No entry has a due date, so the Todos page's empty state is unambiguous
    // proof the route changed.
    await waitFor(() => expect(screen.getByText('All caught up!')).toBeTruthy());
  });
});

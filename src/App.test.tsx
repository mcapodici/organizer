import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { UndoProvider } from './context/UndoContext';
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
  localStorage.clear();
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

// Resolves once the empty state has replaced App's initial "Loading…" paint,
// and returns its heading — which doubles as the handle on the container the
// scoped queries below need.
async function renderHome() {
  render(
    <MemoryRouter initialEntries={['/']}>
      <UndoProvider>
        <App />
      </UndoProvider>
    </MemoryRouter>,
  );
  return await screen.findByRole('heading', { name: 'What to smash next?' });
}

describe('App home empty state', () => {
  it('shows the new home heading', async () => {
    await renderHome();
    expect(screen.queryByText('No timeline selected')).toBeNull();
  });

  it('no longer shows the supporting paragraph', async () => {
    await renderHome();
    expect(screen.queryByText(/Pick one from the/)).toBeNull();
  });

  it('shows the official logo instead of a lucide icon', async () => {
    const heading = await renderHome();
    // Scope to the icon slot above the heading: the action buttons below it
    // render lucide icons of their own, so the whole empty state is not a
    // usable handle for "no <svg>".
    const iconSlot = heading.parentElement!.firstElementChild!;
    expect(iconSlot.querySelector('img')?.getAttribute('src')).toBe('/logo.svg');
    expect(iconSlot.querySelector('svg')).toBeNull();
  });

  it('shows a Todos button next to the New Timeline button', async () => {
    await renderHome();
    expect(screen.getByRole('button', { name: /view todos/i })).toBeTruthy();
  });

  it('places the Todos button after the New Timeline button', async () => {
    const heading = await renderHome();
    // Scope to the empty state — the sidebar renders its own New Timeline control.
    const emptyInner = heading.parentElement!;
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

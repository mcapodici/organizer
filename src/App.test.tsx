import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { FakeAdapter } from './test-utils/fakeAdapter';
import { WELCOME_KEY } from './utils/welcome';

const h = vi.hoisted(() => ({ adapter: null as unknown as FakeAdapter }));
vi.mock('./context/StorageContext', () => ({
  useStorage: () => ({ adapter: h.adapter, markSaved: vi.fn() }),
}));

import App from './App';

// jsdom ships no matchMedia; App reads it to decide the desktop/mobile layout.
// Reporting no match puts it in the mobile branch, which the assertions below
// deliberately avoid depending on.
beforeEach(async () => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  h.adapter = new FakeAdapter();
  localStorage.clear();
  // Without a timeline *and* the welcome flag, App seeds a welcome timeline and
  // navigates away — which would replace the empty state under test.
  localStorage.setItem(WELCOME_KEY, '1');
  await h.adapter.putTimeline({ id: 't1', name: 'Work', createdAt: '2026-01-01T00:00:00Z', tags: [] });
});

function renderApp() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <App />
    </MemoryRouter>,
  );
}

describe('App home empty state', () => {
  it('shows the new home heading', async () => {
    renderApp();
    const heading = await screen.findByRole('heading', { name: 'What to smash next?' });
    expect(heading).toBeTruthy();
    expect(screen.queryByText('No timeline selected')).toBeNull();
  });

  it('shows the official logo instead of a lucide icon in the empty state', async () => {
    renderApp();
    const heading = await screen.findByRole('heading', { name: 'What to smash next?' });
    const inner = heading.parentElement!;
    expect(inner.querySelector('img')?.getAttribute('src')).toBe('/logo.svg');
    expect(inner.querySelector('svg')).toBeNull();
  });
});

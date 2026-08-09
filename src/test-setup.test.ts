import { describe, it, expect, beforeEach } from 'vitest';

// Guards the Web Storage shim in test-setup.ts. Without it, Node 24+ leaves an
// inert built-in `localStorage` on `globalThis` that Vitest refuses to replace
// with jsdom's, and every test touching storage dies with
// "Cannot read properties of undefined". See test-setup.ts for the full story.
describe('web storage in the test environment', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('exposes localStorage and sessionStorage', () => {
    expect(localStorage).toBeTruthy();
    expect(sessionStorage).toBeTruthy();
  });

  it('is reachable via window, which App code uses', () => {
    expect(window.localStorage).toBe(localStorage);
  });

  it('round-trips a value', () => {
    localStorage.setItem('sidebarWidth', '320');
    expect(localStorage.getItem('sidebarWidth')).toBe('320');
  });

  it('returns null for a missing key rather than undefined', () => {
    expect(localStorage.getItem('nope')).toBeNull();
  });

  it('coerces non-string values to strings, as the spec requires', () => {
    localStorage.setItem('n', 42 as unknown as string);
    expect(localStorage.getItem('n')).toBe('42');
  });

  it('supports removeItem, clear, length and key', () => {
    localStorage.setItem('a', '1');
    localStorage.setItem('b', '2');
    expect(localStorage.length).toBe(2);
    expect(localStorage.key(0)).toBe('a');

    localStorage.removeItem('a');
    expect(localStorage.length).toBe(1);
    expect(localStorage.getItem('a')).toBeNull();

    localStorage.clear();
    expect(localStorage.length).toBe(0);
    expect(localStorage.key(0)).toBeNull();
  });

  it('keeps localStorage and sessionStorage separate', () => {
    localStorage.setItem('k', 'local');
    sessionStorage.setItem('k', 'session');
    expect(localStorage.getItem('k')).toBe('local');
    expect(sessionStorage.getItem('k')).toBe('session');
  });
});

import { test as base, expect, type Page } from '@playwright/test';

// Shared E2E setup for the Organizer app.
//
// Storage model (src/context/StorageContext.tsx): on boot the app picks OPFS
// when navigator.storage.getDirectory exists (it does in headless Chromium),
// otherwise IndexedDB (database name "timeline-app"). There is no storage
// picker UI. The `forceIdb` option below removes getDirectory before any app
// code runs so a spec can exercise the IndexedDB adapter for real.
//
// First-run model (src/App.tsx): when there are no timelines and the
// localStorage key `timelines_welcome_created` is unset, the app seeds a
// "Getting Started" welcome timeline. Most specs don't want that noise, so
// `skipWelcome` (default true) pre-sets the key from an init script.

export const WELCOME_KEY = 'timelines_welcome_created';

interface Options {
  /** Remove navigator.storage.getDirectory so the app uses IndexedDB. */
  forceIdb: boolean;
  /** Pre-set the welcome key so the app does not seed the welcome timeline. */
  skipWelcome: boolean;
}

export const test = base.extend<Options>({
  forceIdb: [false, { option: true }],
  skipWelcome: [true, { option: true }],

  page: async ({ page, forceIdb, skipWelcome }, use) => {
    if (forceIdb) {
      await page.addInitScript(() => {
        // The app checks `'getDirectory' in navigator.storage`; deleting the
        // prototype method makes that false and selects the IdbAdapter.
        delete (StorageManager.prototype as Partial<StorageManager>).getDirectory;
      });
    }
    if (skipWelcome) {
      await page.addInitScript((key) => {
        localStorage.setItem(key, '1');
      }, WELCOME_KEY);
    }
    await use(page);
  },
});

export { expect };

/** Wipe localStorage, all IndexedDB databases, and the OPFS root. Assumes the
 * page is already on the app origin. Init scripts (e.g. skipWelcome) re-apply
 * on the next navigation, so call this before the final load of a test. */
export async function wipeStorage(page: Page): Promise<void> {
  await page.evaluate(async () => {
    localStorage.clear();
    const dbs = await indexedDB.databases();
    await Promise.all(
      dbs
        .filter((db): db is { name: string } => typeof db.name === 'string')
        .map(
          (db) =>
            new Promise<void>((resolve) => {
              const req = indexedDB.deleteDatabase(db.name);
              req.onsuccess = req.onerror = req.onblocked = () => resolve();
            }),
        ),
    );
    if ('getDirectory' in navigator.storage) {
      const root = await navigator.storage.getDirectory();
      const keys = (root as unknown as { keys(): AsyncIterable<string> }).keys();
      for await (const name of keys) {
        await root.removeEntry(name, { recursive: true });
      }
    }
  });
}

/** Load the app fresh: navigate, wait for the app shell (so the boot-time
 * storage setup is not mid-flight), explicitly wipe every storage layer,
 * reload, and wait for the shell again. Playwright already gives each test an
 * empty browser context; the wipe makes the clean slate explicit and guards
 * against any state left by earlier navigations within the same test. */
export async function bootApp(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Go home' }).first()).toBeVisible();
  await wipeStorage(page);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Go home' }).first()).toBeVisible();
}

/** Create a timeline via the sidebar and wait until its view is open. */
export async function createTimeline(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: 'New Timeline' }).first().click();
  await page.getByPlaceholder('Timeline name').fill(name);
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
}

/** Type into the TipTap composer and save; waits for the entry card to appear. */
export async function addEntry(page: Page, text: string): Promise<void> {
  const editor = page.locator('.ProseMirror');
  await editor.click();
  await editor.fill(text);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText(text, { exact: true })).toBeVisible();
}

/** Today's date as a local YYYY-MM-DD string (what date inputs expect). */
export function todayLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

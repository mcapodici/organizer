import { test, expect, bootApp, WELCOME_KEY } from './fixtures';

// The app has no storage picker: StorageContext boots straight into OPFS when
// navigator.storage.getDirectory exists, otherwise IndexedDB. First run seeds
// a "Getting Started" welcome timeline unless timelines_welcome_created is set.

test.describe('first run (default storage)', () => {
  test.use({ skipWelcome: false });

  test('boots past loading and seeds the welcome timeline', async ({ page }) => {
    // A fresh Playwright context has empty storage, so this really is a first
    // run. bootApp()'s wipe-and-reload would race the async welcome seed the
    // first load kicks off, so load once and assert directly.
    await page.goto('/');
    // The welcome timeline is created and opened automatically.
    await expect(page.getByRole('heading', { level: 1, name: 'Getting Started' })).toBeVisible();
    await expect(page.getByText('Welcome to Organizer', { exact: false })).toBeVisible();
    // It also shows up in the sidebar list.
    await expect(
      page.getByRole('button', { name: 'Getting Started' }).first(),
    ).toBeVisible();
    // The seed marked the welcome key so it never re-seeds.
    expect(await page.evaluate((k) => localStorage.getItem(k), WELCOME_KEY)).toBe('1');
  });
});

test('second visit with the welcome key set does not re-seed', async ({ page }) => {
  // skipWelcome (default) pre-sets timelines_welcome_created, simulating a
  // return visit after the user deleted the welcome timeline.
  await bootApp(page);
  await expect(page.getByRole('heading', { name: 'What to smash next?' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Getting Started' })).toHaveCount(0);
});

test.describe('forced IndexedDB storage', () => {
  test.use({ forceIdb: true });

  test('boots into the app shell without OPFS', async ({ page }) => {
    await bootApp(page);
    await expect(page.getByRole('heading', { name: 'What to smash next?' })).toBeVisible();
    // Sanity: the OPFS entry point really is gone in this context.
    expect(
      await page.evaluate(() => 'getDirectory' in navigator.storage),
    ).toBe(false);
  });
});

import { test, expect } from './fixtures';

// Phone-sized viewport: the sidebar collapses into an off-canvas drawer behind
// the burger button. bootApp() waits on the desktop header (hidden at this
// width), so this spec boots by hand.

test.describe('mobile viewport', () => {
  test.use({ viewport: { width: 390, height: 844 }, skipWelcome: false });

  test('the burger opens the drawer and a timeline is reachable', async ({ page }) => {
    // Fresh context = empty storage; loading once avoids racing the async
    // welcome seed with a wipe-and-reload.
    await page.goto('/');

    // First run seeds and opens the welcome timeline; waiting for it also
    // guarantees the app is hydrated before we touch the burger.
    await expect(page.getByRole('heading', { level: 1, name: 'Getting Started' })).toBeVisible();

    // Open the drawer. The sidebar is off-canvas until the burger toggles it,
    // so "in viewport" is the assertion that the drawer really slid in.
    await page.getByRole('button', { name: 'Toggle menu' }).click();
    const timelineBtn = page.locator('aside li').getByRole('button', { name: 'Getting Started' });
    await expect(timelineBtn).toBeInViewport();

    // A timeline is reachable from the drawer.
    await timelineBtn.click();
    await expect(page.getByRole('heading', { level: 1, name: 'Getting Started' })).toBeVisible();
    await expect(page.getByText('Welcome to Organizer', { exact: false })).toBeVisible();
  });
});

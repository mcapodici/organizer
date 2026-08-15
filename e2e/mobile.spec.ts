import { test, expect, bootApp, addEntry, todayLocal } from './fixtures';

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

  test.describe('to-do entry actions stay on screen', () => {
    // Default skipWelcome (true) so we start clean and drive the UI ourselves.
    test.use({ skipWelcome: true });

    test('the Delete button is reachable on a due-dated entry', async ({ page }) => {
      await bootApp(page);

      // On mobile "New Timeline" lives off-canvas; the empty-home button opens
      // the drawer with the create form. Drive that instead of createTimeline().
      await page.locator('main').getByRole('button', { name: 'New Timeline' }).click();
      await page.getByPlaceholder('Timeline name').fill('Acme Corp');
      await page.getByRole('button', { name: 'Add', exact: true }).click();
      await expect(page.getByRole('heading', { level: 1, name: 'Acme Corp' })).toBeVisible();
      await addEntry(page, 'Chase signed contract from procurement');

      // Turn the entry into a to-do so its meta row carries the due badge +
      // Copy / Edit / Delete — the combination that overflowed 390px.
      const card = page.locator('div[id^="entry-"]', {
        hasText: 'Chase signed contract from procurement',
      });
      await card.hover();
      await card.getByRole('button', { name: 'Edit entry' }).click();
      await page.getByRole('button', { name: 'Set due date' }).click();
      await page.locator('input[type="date"]').fill(todayLocal());
      await page.getByRole('button', { name: 'Update' }).click();
      await expect(card.getByRole('button', { name: 'Mark as done' })).toBeVisible();

      // The whole meta row (with the due badge present) must keep Delete within
      // the 390px viewport. Before the flex-wrap fix Delete.right was ~442px,
      // past the edge, and the page does not scroll horizontally.
      await card.hover();
      const deleteBtn = card.getByRole('button', { name: 'Delete entry' });
      await expect(deleteBtn).toBeVisible();
      const box = await deleteBtn.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x + box!.width).toBeLessThanOrEqual(390);

      // And the document itself must not have grown a horizontal scroll.
      const scrollWidth = await page.evaluate(
        () => document.documentElement.scrollWidth,
      );
      expect(scrollWidth).toBeLessThanOrEqual(390);
    });
  });
});

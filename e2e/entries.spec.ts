import { test, expect, bootApp, createTimeline, addEntry } from './fixtures';

test('entry round-trip: create, edit, reload-persist, delete (default storage)', async ({ page }) => {
  await bootApp(page);
  await createTimeline(page, 'Journal');

  // Create an entry through the TipTap composer.
  await addEntry(page, 'First note about the kick-off');

  // Edit it: the card's action buttons are revealed on hover.
  const card = page.locator('div[id^="entry-"]', { hasText: 'First note about the kick-off' });
  await card.hover();
  await card.getByRole('button', { name: 'Edit entry' }).click();
  const editor = page.locator('.ProseMirror');
  await editor.click();
  await editor.fill('First note, now revised');
  await page.getByRole('button', { name: 'Update' }).click();
  await expect(page.getByText('First note, now revised', { exact: true })).toBeVisible();
  await expect(page.getByText('First note about the kick-off')).toHaveCount(0);

  // Survives a real page reload (persistence).
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Journal' })).toBeVisible();
  await expect(page.getByText('First note, now revised', { exact: true })).toBeVisible();

  // Delete it, confirming in the modal.
  const revised = page.locator('div[id^="entry-"]', { hasText: 'First note, now revised' });
  await revised.hover();
  await revised.getByRole('button', { name: 'Delete entry' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByText('First note, now revised')).toHaveCount(0);
  // The timeline's auto-created start entry is untouched.
  await expect(page.getByText('Timeline Start', { exact: true })).toBeVisible();
});

test.describe('forced IndexedDB storage', () => {
  test.use({ forceIdb: true });

  test('an entry persists across reload in IndexedDB', async ({ page }) => {
    await bootApp(page);
    await createTimeline(page, 'Idb Journal');
    await addEntry(page, 'Persisted via IndexedDB');

    // Prove the write landed in the "timeline-app" IndexedDB database.
    const dbNames = await page.evaluate(async () =>
      (await indexedDB.databases()).map((db) => db.name),
    );
    expect(dbNames).toContain('timeline-app');

    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Idb Journal' })).toBeVisible();
    await expect(page.getByText('Persisted via IndexedDB', { exact: true })).toBeVisible();
  });
});

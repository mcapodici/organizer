import { test, expect, bootApp, createTimeline } from './fixtures';

test('tag a timeline and filter the sidebar by that tag', async ({ page }) => {
  await bootApp(page);
  await createTimeline(page, 'Work Log');
  await createTimeline(page, 'Garden Diary');

  // Add a tag to Work Log via its kebab menu.
  const workItem = page.locator('aside li', { hasText: 'Work Log' });
  await workItem.getByRole('button', { name: 'Timeline options' }).click();
  await workItem.getByRole('button', { name: 'Edit Tags' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Edit Tags' })).toBeVisible();
  await dialog.getByPlaceholder('Add tag…').fill('office');
  await dialog.getByPlaceholder('Add tag…').press('Enter');
  await expect(dialog.getByRole('button', { name: 'Remove office' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Save' }).click();

  // The tag chip renders on the sidebar item.
  await expect(workItem.getByText('office', { exact: true })).toBeVisible();

  // Open the tag filter and select the tag: only Work Log stays listed.
  await page.getByRole('button', { name: 'Filter by tags' }).filter({ visible: true }).first().click();
  await page.getByRole('button', { name: 'office', exact: true }).click();
  await expect(page.locator('aside li', { hasText: 'Work Log' })).toBeVisible();
  await expect(page.locator('aside li', { hasText: 'Garden Diary' })).toHaveCount(0);

  // Clearing the filter brings the untagged timeline back.
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(page.locator('aside li', { hasText: 'Garden Diary' })).toBeVisible();
});

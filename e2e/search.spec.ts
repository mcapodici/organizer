import { test, expect, bootApp, createTimeline, addEntry } from './fixtures';

test('search finds entry text and clicks through to the entry', async ({ page }) => {
  await bootApp(page);
  await createTimeline(page, 'Meeting Notes');
  await addEntry(page, 'The quarterly report is ready for review');

  // Navigate away so the click-through is a real navigation.
  await page.getByRole('button', { name: 'Go home' }).filter({ visible: true }).first().click();
  await expect(page.getByRole('heading', { name: 'What to smash next?' })).toBeVisible();

  // Type into the header search box; a result dropdown appears.
  const search = page.getByRole('searchbox', { name: 'Search entries' }).filter({ visible: true }).first();
  await search.fill('quarterly');
  const result = page.getByRole('button', { name: /Meeting Notes.*quarterly/s });
  await expect(result).toBeVisible();
  // The matched word is highlighted in the snippet.
  await expect(result.locator('mark', { hasText: 'quarterly' })).toBeVisible();

  // Click through: lands on the timeline with the entry on screen.
  await result.click();
  await expect(page.getByRole('heading', { level: 1, name: 'Meeting Notes' })).toBeVisible();
  await expect(page.getByText('The quarterly report is ready for review', { exact: true })).toBeVisible();
});

import { test, expect, bootApp, createTimeline, addEntry } from './fixtures';

test('search finds entry text and clicks through to the entry', async ({ page }) => {
  await bootApp(page);
  await createTimeline(page, 'Meeting Notes');
  await addEntry(page, 'The quarterly report is ready for review');

  // Navigate away so the click-through is a real navigation.
  await page.getByRole('button', { name: 'Go home' }).filter({ visible: true }).first().click();
  await expect(page.getByRole('heading', { name: 'What to smash next?' })).toBeVisible();

  // Type into the header search box; a result dropdown appears.
  const search = page.getByRole('combobox', { name: 'Search entries' }).filter({ visible: true }).first();
  await search.fill('quarterly');
  const result = page.getByRole('option', { name: /Meeting Notes.*quarterly/s });
  await expect(result).toBeVisible();
  // The matched word is highlighted in the snippet.
  await expect(result.locator('mark', { hasText: 'quarterly' })).toBeVisible();

  // Click through: lands on the timeline with the entry on screen.
  await result.click();
  await expect(page.getByRole('heading', { level: 1, name: 'Meeting Notes' })).toBeVisible();
  await expect(page.getByText('The quarterly report is ready for review', { exact: true })).toBeVisible();
});

test('search results are navigable and activatable with the keyboard', async ({ page }) => {
  await bootApp(page);
  await createTimeline(page, 'Logistics');
  await addEntry(page, 'The delivery arrived on Tuesday morning');
  await createTimeline(page, 'Errands');
  await addEntry(page, 'Schedule the delivery pickup for later');

  // Navigate away so Enter causes a real navigation.
  await page.getByRole('button', { name: 'Go home' }).filter({ visible: true }).first().click();
  await expect(page.getByRole('heading', { name: 'What to smash next?' })).toBeVisible();

  const search = page.getByRole('combobox', { name: 'Search entries' }).filter({ visible: true }).first();
  await search.fill('delivery');

  // The input exposes combobox semantics and the dropdown is a listbox.
  await expect(search).toHaveAttribute('role', 'combobox');
  await expect(search).toHaveAttribute('aria-expanded', 'true');
  const listbox = page.getByRole('listbox', { name: 'Search results' });
  await expect(listbox).toBeVisible();
  const options = listbox.getByRole('option');
  await expect(options).toHaveCount(2);

  // ArrowDown highlights the first result and tracks it via aria-activedescendant.
  await search.press('ArrowDown');
  const firstId = await options.nth(0).getAttribute('id');
  await expect(search).toHaveAttribute('aria-activedescendant', firstId!);
  await expect(options.nth(0)).toHaveAttribute('aria-selected', 'true');

  // ArrowDown again moves the highlight to the second result.
  await search.press('ArrowDown');
  const secondId = await options.nth(1).getAttribute('id');
  await expect(search).toHaveAttribute('aria-activedescendant', secondId!);
  await expect(options.nth(1)).toHaveAttribute('aria-selected', 'true');

  // ArrowUp moves back to the first result.
  await search.press('ArrowUp');
  await expect(search).toHaveAttribute('aria-activedescendant', firstId!);

  // Enter opens the highlighted result.
  await search.press('Enter');
  await expect(page.getByRole('heading', { level: 1, name: 'Logistics' })).toBeVisible();
  await expect(page.getByText('The delivery arrived on Tuesday morning', { exact: true })).toBeVisible();
});

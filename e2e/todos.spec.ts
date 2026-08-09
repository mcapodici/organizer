import { test, expect, bootApp, createTimeline, addEntry, todayLocal } from './fixtures';

test('mark an entry as a todo, see it on the todos page, complete it', async ({ page }) => {
  await bootApp(page);
  await createTimeline(page, 'Chores');
  await addEntry(page, 'Buy groceries');

  // Turn the entry into a todo: edit it and set a due date of today.
  const card = page.locator('div[id^="entry-"]', { hasText: 'Buy groceries' });
  await card.hover();
  await card.getByRole('button', { name: 'Edit entry' }).click();
  await page.getByRole('button', { name: 'Set due date' }).click();
  await page.locator('input[type="date"]').fill(todayLocal());
  await page.getByRole('button', { name: 'Update' }).click();

  // The card now wears the due-date lozenge with a not-done check button.
  await expect(card.getByRole('button', { name: 'Mark as done' })).toBeVisible();

  // The todo shows up on the todos page, due now.
  await page.getByRole('button', { name: 'Todos' }).filter({ visible: true }).first().click();
  await expect(page.getByRole('heading', { name: 'Todos' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Due Now' })).toBeVisible();
  await expect(page.getByText('Buy groceries')).toBeVisible();

  // Complete it; the list empties out. The row re-renders as counts load, so
  // retry the click until the completion actually lands.
  const markDone = page.getByRole('button', { name: 'Mark as done' });
  await expect(async () => {
    if (await markDone.isVisible()) await markDone.click();
    await expect(page.getByText('All caught up!')).toBeVisible({ timeout: 2000 });
  }).toPass();
  await expect(page.getByText('Buy groceries')).toHaveCount(0);
});

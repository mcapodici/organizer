import { test, expect, bootApp, createTimeline, todayLocal } from './fixtures';

// Only todo-field changes (dueDate/isDone) register an undo — see
// src/utils/todoUndo.ts. The bar expires after ~10s on its own; expiry is
// timer-owned and not covered here, only the register → undo round-trip.

test('marking a todo done shows the undo bar, and Undo reverts it', async ({ page }) => {
  await bootApp(page);
  await createTimeline(page, 'Undo Lab');

  // Create an entry that is already a todo (due today, not done).
  const editor = page.locator('.ProseMirror');
  await editor.click();
  await editor.fill('Water the plants');
  await page.getByRole('button', { name: 'Set due date' }).click();
  await page.locator('input[type="date"]').fill(todayLocal());
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  const card = page.locator('div[id^="entry-"]', { hasText: 'Water the plants' });
  await expect(card.getByRole('button', { name: 'Mark as done' })).toBeVisible();

  // Undoable action: complete the todo from the card's lozenge. The card
  // re-renders right after the save, which can swallow a click dispatched at
  // the wrong moment — retry until the done state actually flips.
  const markDone = card.getByRole('button', { name: 'Mark as done' });
  await expect(async () => {
    if (await markDone.isVisible()) await markDone.click();
    await expect(card.getByRole('button', { name: 'Mark as not done' })).toBeVisible({ timeout: 2000 });
  }).toPass();
  // The undo bar announces the change with a live countdown and an Undo button.
  await expect(page.getByRole('status').filter({ hasText: 'Marked done' })).toBeVisible();

  // Undo: the todo flips back to not-done and the bar goes away.
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(card.getByRole('button', { name: 'Mark as done' })).toBeVisible();
  await expect(page.getByRole('status')).toHaveCount(0);
});

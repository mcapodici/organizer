import { test, expect, bootApp, createTimeline } from './fixtures';

test('create, rename, and delete a timeline from the sidebar', async ({ page }) => {
  await bootApp(page);

  // Create.
  await createTimeline(page, 'Project Atlas');
  const sidebarItem = page.locator('aside li', { hasText: 'Project Atlas' });
  await expect(sidebarItem).toBeVisible();

  // Rename via the per-timeline kebab menu.
  await sidebarItem.getByRole('button', { name: 'Timeline options' }).click();
  await sidebarItem.getByRole('button', { name: 'Rename' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Rename Timeline' })).toBeVisible();
  await dialog.getByRole('textbox').fill('Project Beacon');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('aside li', { hasText: 'Project Beacon' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'Project Beacon' })).toBeVisible();

  // Delete, confirming in the modal.
  const renamedItem = page.locator('aside li', { hasText: 'Project Beacon' });
  await renamedItem.getByRole('button', { name: 'Timeline options' }).click();
  await renamedItem.getByRole('button', { name: 'Delete' }).click();
  const deleteDialog = page.getByRole('dialog');
  await expect(deleteDialog.getByRole('heading', { name: 'Delete Timeline' })).toBeVisible();
  await deleteDialog.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.locator('aside li', { hasText: 'Project Beacon' })).toHaveCount(0);
  // With no timeline selected the app falls back to the home screen.
  await expect(page.getByRole('heading', { name: 'What to smash next?' })).toBeVisible();
});

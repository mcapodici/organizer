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

test('the brand logo loads on every route (base path is honored)', async ({ page }) => {
  await bootApp(page);

  // On the empty/home state, every logo image must actually render: a broken
  // 404 leaves naturalWidth === 0. This fails when the logo is referenced with
  // a root-absolute `/logo.svg` because the app is served under `/app/`.
  const logos = page.locator('img[alt=""], img[alt="Organizer"]');
  const count = await logos.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    const logo = logos.nth(i);
    await expect(logo).toHaveJSProperty('complete', true);
    expect(await logo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  }
});

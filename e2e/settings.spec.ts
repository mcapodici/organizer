import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, expect, bootApp, createTimeline, addEntry } from './fixtures';

test('export from settings, wipe the data, and re-import it intact', async ({ page }) => {
  await bootApp(page);
  await createTimeline(page, 'Backup Test');
  await addEntry(page, 'Precious data that must survive');

  // Export from the settings page; capture the download outside the repo.
  await page.getByRole('button', { name: 'Settings' }).filter({ visible: true }).first().click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^timelines-\d{4}-\d{2}-\d{2}\.json$/);
  const exportPath = join(mkdtempSync(join(tmpdir(), 'organizer-e2e-')), download.suggestedFilename());
  await download.saveAs(exportPath);

  // Destroy the data so the import assertion cannot pass vacuously.
  await page.getByRole('button', { name: 'Go home' }).filter({ visible: true }).first().click();
  const item = page.locator('aside li', { hasText: 'Backup Test' });
  await item.getByRole('button', { name: 'Timeline options' }).click();
  await item.getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.locator('aside li', { hasText: 'Backup Test' })).toHaveCount(0);

  // Import the export back (replace mode).
  await page.getByRole('button', { name: 'Settings' }).filter({ visible: true }).first().click();
  await page.locator('input[type="file"]').setInputFiles(exportPath);
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Import Data' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Replace all data' }).click();

  // The timeline and its entry are back, and they survived a real reload.
  await page.getByRole('button', { name: 'Go home' }).filter({ visible: true }).first().click();
  const restored = page.locator('aside li', { hasText: 'Backup Test' });
  await expect(restored).toBeVisible();
  await restored.getByRole('button', { name: 'Backup Test' }).click();
  await expect(page.getByText('Precious data that must survive', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Precious data that must survive', { exact: true })).toBeVisible();
});

test('"Clear everything" actually wipes all data', async ({ page }) => {
  await bootApp(page);
  await createTimeline(page, 'Doomed Timeline');
  await addEntry(page, 'This entry should be permanently deleted');

  // Open Settings and trigger the destructive clear.
  await page.getByRole('button', { name: 'Settings' }).filter({ visible: true }).first().click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await page.getByRole('button', { name: 'Clear' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Clear all data' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Clear everything' }).click();

  // The timeline is gone from the sidebar and stays gone across a real reload.
  await expect(page.locator('aside li', { hasText: 'Doomed Timeline' })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Go home' }).first()).toBeVisible();
  await expect(page.locator('aside li', { hasText: 'Doomed Timeline' })).toHaveCount(0);
});

test('importing malformed JSON shows a visible error and leaves data intact', async ({ page }) => {
  await bootApp(page);
  await createTimeline(page, 'Survivor Timeline');
  await addEntry(page, 'Data that must survive a bad import');

  // Write a file that is not valid JSON but carries a .json extension.
  const badPath = join(mkdtempSync(join(tmpdir(), 'organizer-e2e-')), 'broken.json');
  writeFileSync(badPath, 'this is { not valid JSON at all');

  await page.getByRole('button', { name: 'Settings' }).filter({ visible: true }).first().click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles(badPath);
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Import Data' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Replace all data' }).click();

  // A visible error is shown and the modal stays open so the user can retry.
  await expect(dialog.getByRole('alert')).toContainText('not valid JSON');
  await expect(dialog.getByRole('heading', { name: 'Import Data' })).toBeVisible();

  // The original data is untouched, even across a real reload.
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await page.getByRole('button', { name: 'Go home' }).filter({ visible: true }).first().click();
  const survivor = page.locator('aside li', { hasText: 'Survivor Timeline' });
  await expect(survivor).toBeVisible();
  await survivor.getByRole('button', { name: 'Survivor Timeline' }).click();
  await expect(page.getByText('Data that must survive a bad import', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Data that must survive a bad import', { exact: true })).toBeVisible();
});

import { mkdtempSync } from 'node:fs';
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

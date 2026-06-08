// Screenshot harness for the docs.
//
// Launches the app (must already be running at APP_URL), seeds realistic data
// straight into IndexedDB, then captures cropped PNGs into docs/public/screenshots/.
// Re-runnable: it wipes and reseeds each time, so screenshots stay consistent.
//
//   1. npm run app:dev            # serves http://localhost:5174/app/
//   2. node scripts/seed-and-shoot.mjs
//
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../docs/public/screenshots');
mkdirSync(OUT, { recursive: true });

const APP_URL = 'http://localhost:5174/app/';
const VIEWPORT = { width: 1440, height: 900 };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 });
  const page = await ctx.newPage();

  // Make the app believe the File System Access API exists so the storage
  // chooser renders (headless Chromium lacks showDirectoryPicker otherwise).
  await page.addInitScript(() => {
    if (!('showDirectoryPicker' in window)) {
      // eslint-disable-next-line no-undef
      window.showDirectoryPicker = () => Promise.reject(new Error('stub'));
    }
  });

  // ---- 1. Storage picker (no storageMode set yet) -------------------------
  await page.goto(APP_URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => { localStorage.removeItem('storageMode'); });
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByText('Choose storage').waitFor({ timeout: 8000 });
  await sleep(400);
  const pickerCard = page.locator('[class*="card"]').first();
  await shoot(pickerCard, 'storage-picker.png');

  // ---- 2. Seed data, then boot into the app -------------------------------
  await page.evaluate(() => {
    localStorage.setItem('storageMode', 'idb');
    localStorage.setItem('timelines_welcome_created', '1'); // skip auto welcome timeline
  });
  await page.reload({ waitUntil: 'networkidle' });
  await sleep(600); // let the empty app create the IDB stores

  const seeded = await page.evaluate(seedData);
  console.log('  seeded:', JSON.stringify(seeded));
  const firstTimelineId = seeded.id;

  // A hash-only goto won't reload the SPA, so set the hash then do a real reload
  // so the freshly-seeded data is actually read into app state.
  await page.evaluate((id) => { window.location.hash = '#/timelines/' + id; }, firstTimelineId);
  await page.reload({ waitUntil: 'networkidle' });
  await sleep(900);
  await page.locator('.ProseMirror, [class*="card"]').first().waitFor({ timeout: 8000 }).catch(() => {});

  // ---- 3. Hero: whole app on the Acme Corp timeline -----------------------
  await page.screenshot({ path: resolve(OUT, 'hero.png') });

  // ---- 4. A single richly-formatted entry ---------------------------------
  await tagEntryByText(page, 'Weekly status', 'shot-rich');
  await shoot(page.locator('#shot-rich'), 'entry-rich.png');

  // ---- 5. An entry with attachments (inline image + file link) ------------
  await tagEntryByText(page, 'Signed MSA', 'shot-attach');
  await page.locator('#shot-attach').scrollIntoViewIfNeeded();
  await sleep(400);
  await shoot(page.locator('#shot-attach'), 'attachments.png');

  // ---- 6. The editor / formatting toolbar ---------------------------------
  const editor = page.locator('.ProseMirror').first();
  await editor.click();
  await editor.type('Met the supplier on site — delivery confirmed for the 22nd.');
  await sleep(300);
  await shoot(page.locator('[class*="composer"]').first(), 'editor-toolbar.png');
  // clear the typed text so it isn't saved anywhere
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');

  // ---- 7. Tag filter open in the sidebar ----------------------------------
  // The filter toggle sits next to "New Timeline" at the top of the sidebar.
  const filterBtn = page.locator('[class*="sidebar"] button[title*="ilter"], [class*="sidebar"] [aria-label*="ilter"]').first();
  if (await filterBtn.count()) {
    await filterBtn.click().catch(() => {});
    await sleep(400);
  }
  // Clip the populated top of the sidebar (avoids a tall tail of whitespace).
  await page.screenshot({ path: resolve(OUT, 'tags-sidebar.png'), clip: { x: 0, y: 56, width: 300, height: 490 } });
  console.log('  ✓ tags-sidebar.png');

  // ---- 8. Search results dropdown -----------------------------------------
  const search = page.locator('input[type="search"], input[placeholder*="earch"]').first();
  await search.click();
  await search.fill('delivery');
  await sleep(700);
  // Clip tightly around the search box + its dropdown using the input's box.
  const sb = await search.boundingBox();
  await page.screenshot({ path: resolve(OUT, 'search.png'), clip: {
    x: Math.max(0, Math.round(sb.x - 16)),
    y: 0,
    width: Math.min(560, VIEWPORT.width - Math.round(sb.x - 16)),
    height: 360,
  } });
  console.log('  ✓ search.png');
  // Clear the search so it doesn't leak into the next screenshot.
  await search.fill('');
  await page.keyboard.press('Escape');
  // Close the filter panel for a clean sidebar on the Todos page.
  if (await filterBtn.count()) { await filterBtn.click().catch(() => {}); await sleep(300); }

  // ---- 9. Todos page ------------------------------------------------------
  await page.goto(APP_URL + '#/todos', { waitUntil: 'networkidle' });
  await sleep(800);
  await page.screenshot({ path: resolve(OUT, 'todos.png') });
  console.log('  ✓ todos.png');

  await browser.close();
  console.log('Screenshots written to', OUT);
}

async function shoot(locator, name) {
  try {
    await locator.screenshot({ path: resolve(OUT, name) });
    console.log('  ✓', name);
  } catch (e) {
    console.warn('  ✗', name, '-', e.message);
  }
}

// Give the entry card whose text contains `needle` a stable id for cropping.
async function tagEntryByText(page, needle, id) {
  await page.evaluate(({ needle, id }) => {
    const cards = [...document.querySelectorAll('[class*="card"]')];
    const hit = cards.find((c) => c.textContent && c.textContent.includes(needle)
      && c.querySelector('time')); // entry cards carry a <time>
    if (hit) hit.id = id;
  }, { needle, id });
  await page.locator('#' + id).first().waitFor({ timeout: 5000 });
}

// Runs in the page. Seeds timelines, entries, blobs into the app's IndexedDB.
// Returns the id of the timeline to open for the hero shot.
function seedData() {
  return new Promise(async (resolveSeed) => {
    const pad = (n) => String(n).padStart(2, '0');
    const today = new Date();
    const dueIn = (days) => { const x = new Date(today); x.setDate(x.getDate() + days); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`; };
    const ts = (daysAgo, h = 10, min = 0) => { const x = new Date(today); x.setDate(x.getDate() - daysAgo); x.setHours(h, min, 0, 0); return x.toISOString(); };
    const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Math.random().toString(16).slice(2));

    // --- TipTap JSON builders ---
    const txt = (text, ...marks) => ({ type: 'text', text, ...(marks.length ? { marks: marks.map((m) => (typeof m === 'string' ? { type: m } : m)) } : {}) });
    const para = (...c) => ({ type: 'paragraph', ...(c.length ? { content: c } : {}) });
    const heading = (level, ...c) => ({ type: 'heading', attrs: { level }, content: c });
    const bullet = (...items) => ({ type: 'bulletList', content: items.map((c) => ({ type: 'listItem', content: [{ type: 'paragraph', content: c }] })) });
    const taskList = (...items) => ({ type: 'taskList', content: items.map(([checked, c]) => ({ type: 'taskItem', attrs: { checked }, content: [{ type: 'paragraph', content: c }] })) });
    const hcell = (...c) => ({ type: 'tableHeader', content: [{ type: 'paragraph', content: c }] });
    const cell = (...c) => ({ type: 'tableCell', content: [{ type: 'paragraph', content: c }] });
    const trow = (...cells) => ({ type: 'tableRow', content: cells });
    const table = (...rows) => ({ type: 'table', content: rows });
    const doc = (...c) => JSON.stringify({ type: 'doc', content: c });

    // --- a generated chart image for an attachment ---
    function chartPng() {
      const c = document.createElement('canvas');
      c.width = 520; c.height = 280;
      const x = c.getContext('2d');
      x.fillStyle = '#ffffff'; x.fillRect(0, 0, 520, 280);
      x.fillStyle = '#111827'; x.font = '600 18px Inter, sans-serif';
      x.fillText('Q2 forecast vs. actual', 24, 34);
      const bars = [120, 160, 140, 200, 175, 230];
      const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
      bars.forEach((h, i) => {
        const bx = 40 + i * 78;
        x.fillStyle = i % 2 ? '#6366f1' : '#a5b4fc';
        x.fillRect(bx, 250 - h, 48, h);
        x.fillStyle = '#6b7280'; x.font = '12px Inter, sans-serif';
        x.fillText(labels[i], bx + 12, 268);
      });
      return new Promise((res) => c.toBlob((b) => b.arrayBuffer().then(res), 'image/png'));
    }

    const chartBuf = await chartPng();
    const chartKey = uid();
    const pdfKey = uid();
    const pdfBuf = new TextEncoder().encode('%PDF-1.4 stub signed MSA').buffer;

    // --- timelines ---
    const T = (name, tags, daysAgo) => ({ id: uid(), name, createdAt: ts(daysAgo, 9), updatedAt: ts(0, 12), tags });
    const acme = T('Acme Corp', ['client', 'active'], 40);
    const kitchen = T('Kitchen remodel', ['project', 'active'], 30);
    const marathon = T('Marathon training', ['personal'], 60);
    const journal = T('Journal', ['personal'], 90);
    const elm = T('14 Elm St', ['property'], 200);
    const timelines = [acme, kitchen, marathon, journal, elm];

    // --- entries ---
    const start = (tl, daysAgo) => ({ id: uid(), timelineId: tl.id, content: doc(para(txt('Timeline Start'))), timestamp: ts(daysAgo, 8), attachments: [], isStart: true });
    const E = (tl, daysAgo, content, extra = {}) => ({ id: uid(), timelineId: tl.id, content, timestamp: ts(daysAgo, 10 + (daysAgo % 6)), attachments: [], isStart: false, ...extra });

    const entries = [];

    // Acme Corp — the hero timeline
    entries.push(start(acme, 40));
    entries.push(E(acme, 38, doc(
      heading(3, txt('Kickoff call')),
      para(txt('Spoke with '), txt('Dana', 'bold'), txt(' and the ops team. They want a phased rollout starting in '), txt('Q3', 'highlight'), txt('.')),
      bullet([txt('Primary contact: Dana Whitfield')], [txt('Budget signed off to '), txt('$48k', 'bold')], [txt('Decision by end of month')]),
    )));
    entries.push(E(acme, 25, doc(
      heading(3, txt('Weekly status')),
      para(txt('Good progress this week. Integration is '), txt('on track', 'highlight'), txt('; one '), txt('blocker', 'bold'), txt(' on SSO config (their IdP).')),
      taskList([true, [txt('Send revised SOW')]], [true, [txt('Schedule technical review')]], [false, [txt('Get SSO metadata from IT')]]),
      table(
        trow(hcell(txt('Workstream')), hcell(txt('Owner')), hcell(txt('Status'))),
        trow(cell(txt('Data import')), cell(txt('Priya')), cell(txt('Done', 'highlight'))),
        trow(cell(txt('SSO')), cell(txt('Us')), cell(txt('Blocked', 'bold'))),
        trow(cell(txt('Training')), cell(txt('Dana')), cell(txt('Not started'))),
      ),
      para(txt('Notes in '), txt('config.yaml', 'code'), txt(' — see attached.')),
    )));
    entries.push(E(acme, 12, doc(
      heading(3, txt('Signed MSA received')),
      para(txt('Countersigned master agreement came back today. Filing it here and the Q2 forecast deck Dana shared.')),
    ), { attachments: [
      { id: chartKey, name: 'q2-forecast.png', mimeType: 'image/png', size: chartBuf.byteLength, blobKey: chartKey },
      { id: pdfKey, name: 'Acme-MSA-signed.pdf', mimeType: 'application/pdf', size: 184320, blobKey: pdfKey },
    ] }));
    entries.push(E(acme, 6, doc(para(txt('Chase signed contract from procurement — no reply yet.'))), { dueDate: dueIn(-3), isDone: false }));
    entries.push(E(acme, 2, doc(para(txt('Send revised quote with the phased pricing.'))), { dueDate: dueIn(0), isDone: false }));

    // Kitchen remodel
    entries.push(start(kitchen, 30));
    entries.push(E(kitchen, 20, doc(
      heading(3, txt('Design locked')),
      para(txt('Went with the '), txt('shaker', 'bold'), txt(' fronts in off-white. Worktop: oak.')),
    )));
    entries.push(E(kitchen, 8, doc(para(txt('Pay deposit to the fitter (50%).'))), { dueDate: dueIn(-2), isDone: false }));
    entries.push(E(kitchen, 4, doc(para(txt('Confirm appliance delivery date with the supplier.'))), { dueDate: dueIn(3), isDone: false }));

    // Marathon training
    entries.push(start(marathon, 60));
    entries.push(E(marathon, 5, doc(para(txt('Tempo run, 6 miles. Legs felt strong.')))));
    entries.push(E(marathon, 1, doc(para(txt('Long run — 18 miles along the canal.'))), { dueDate: dueIn(6), isDone: false }));

    // Journal
    entries.push(start(journal, 90));
    entries.push(E(journal, 3, doc(
      heading(3, txt('Saturday')),
      para(txt('Quiet morning, walked the coast path. '), txt('Grateful', 'highlight'), txt(' for the weather.')),
    )));

    // 14 Elm St
    entries.push(start(elm, 200));
    entries.push(E(elm, 30, doc(para(txt('Annual boiler service done. Next due in 12 months.'))), { dueDate: dueIn(330), isDone: false }));

    // --- write everything to IndexedDB ---
    // Open at version 2 with a store-creating upgrade so seeding works even if
    // the app hasn't initialised the DB yet (mirrors src/db/schema.ts).
    const open = indexedDB.open('timeline-app', 2);
    open.onupgradeneeded = () => {
      const db = open.result;
      if (!db.objectStoreNames.contains('timelines')) db.createObjectStore('timelines', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('entries')) {
        const s = db.createObjectStore('entries', { keyPath: 'id' });
        s.createIndex('by-timeline', 'timelineId');
      }
      if (!db.objectStoreNames.contains('blobs')) db.createObjectStore('blobs');
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
    };
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction(['timelines', 'entries', 'blobs', 'meta'], 'readwrite');
      timelines.forEach((t) => tx.objectStore('timelines').put(t));
      entries.forEach((e) => tx.objectStore('entries').put(e));
      tx.objectStore('blobs').put(chartBuf, chartKey);
      tx.objectStore('blobs').put(pdfBuf, pdfKey);
      tx.objectStore('meta').put(uid(), 'saveId');
      tx.oncomplete = () => resolveSeed({ id: acme.id, timelines: timelines.length, entries: entries.length });
      tx.onerror = () => resolveSeed({ id: acme.id, error: String(tx.error) });
    };
    open.onerror = () => resolveSeed({ id: acme.id, error: String(open.error) });
  });
}

main().catch((e) => { console.error(e); process.exit(1); });

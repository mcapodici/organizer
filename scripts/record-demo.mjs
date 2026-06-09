// Records a short, silent product walkthrough of Organizer.
//
// Style: a FIXED 125% zoom (no camera movement) with a full-screen description
// card shown for a few seconds before each action. Two passes over a persistent
// profile so the recording starts clean:
//   Pass 1 (not recorded): seed IndexedDB + storage choice into the profile.
//   Pass 2 (recorded):     load the seeded app and run the narrated walkthrough.
//
// The "125% zoom" is achieved by laying the app out at 1536x864 (= 1920/1.25,
// 1080/1.25) and upscaling to 1080p when encoding — i.e. the UI is rendered
// larger, exactly like Chrome at 125%, and never moves.
//
//   1. npm run app:dev               # serves http://localhost:5174/app/
//   2. node scripts/record-demo.mjs
//
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { mkdirSync, readdirSync, existsSync, rmSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { seedData } from './seed-and-shoot.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '../docs/public/video');
const RAW_DIR = resolve(__dirname, '../.demo-raw');
const PROFILE = resolve(__dirname, '../.demo-profile');
for (const d of [RAW_DIR, PROFILE]) { rmSync(d, { recursive: true, force: true }); mkdirSync(d, { recursive: true }); }
mkdirSync(OUT_DIR, { recursive: true });

const APP_URL = 'http://localhost:5174/app/';
// Layout at 1536x864; upscale ×1.25 to 1920x1080 on encode → a fixed 125% zoom.
const VW = 1536, VH = 864;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const FF_CANDIDATES = [resolve(__dirname, '../.ffmpeg/bin/ffmpeg.exe'), 'ffmpeg'];
const LOGO_SVG = readFileSync(resolve(__dirname, '../docs/public/logo.svg'), 'utf8');

// Description-card overlay + a smooth content scroller, injected into the page.
function installOverlay() {
  // Fraunces (the hero wordmark font) so the intro slide matches the site hero.
  const font = document.createElement('link');
  font.rel = 'stylesheet';
  font.href = 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600&display=swap';
  document.head.appendChild(font);

  const style = document.createElement('style');
  style.textContent = `
    #__card{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;
      background:linear-gradient(135deg,#6366f1 0%,#4f46e5 100%);opacity:0;transition:opacity 360ms ease;
      pointer-events:none;font-family:Inter,system-ui,-apple-system,sans-serif;color:#fff;text-align:center;padding:0 9%}
    #__card .k{font-size:28px;letter-spacing:.2em;text-transform:uppercase;opacity:.82;margin:0 0 36px;font-weight:600}
    #__card h1{font-size:96px;line-height:1.05;margin:0 0 32px;font-weight:700;letter-spacing:-0.01em}
    #__card p{font-size:44px;line-height:1.4;margin:0 auto;max-width:1200px;opacity:.92;font-weight:400}
    /* Static hero opening — mirrors the site hero (logo + wordmark + tagline). */
    #__hero{position:fixed;inset:0;z-index:100000;display:flex;flex-direction:column;align-items:center;
      justify-content:center;background:#ffffff;font-family:Inter,system-ui,-apple-system,sans-serif}
    #__hero svg{width:176px;height:176px;margin:0 0 36px;display:block}
    #__hero .hname{font-family:'Fraunces',Georgia,serif;font-weight:600;font-size:108px;color:#1b1f3b;
      letter-spacing:-0.01em;line-height:1;margin:0 0 28px}
    #__hero .htag{font-size:38px;color:#5b6178;font-weight:400;max-width:1150px;text-align:center;line-height:1.4}
  `;
  document.head.appendChild(style);
  const el = document.createElement('div');
  el.id = '__card';
  document.body.appendChild(el);
  window.__card = (k, h, p) => {
    el.innerHTML = `<div>${k ? `<div class="k">${k}</div>` : ''}<h1>${h}</h1>${p ? `<p>${p}</p>` : ''}</div>`;
    el.style.opacity = '1';
  };
  window.__hide = () => { el.style.opacity = '0'; };
  window.__hero = (logoSvg) => {
    let h = document.getElementById('__hero');
    if (!h) { h = document.createElement('div'); h.id = '__hero'; document.body.appendChild(h); }
    h.innerHTML = `${logoSvg}<div class="hname">Organizer</div><div class="htag">Timelines for everything you want to remember.</div>`;
  };
  window.__heroHide = () => { const h = document.getElementById('__hero'); if (h) h.remove(); };
  window.__scrollFrac = (frac, ms) => new Promise((res) => {
    const el2 = [...document.querySelectorAll('*')].filter((e) => {
      const s = getComputedStyle(e);
      return (s.overflowY === 'auto' || s.overflowY === 'scroll') && e.scrollHeight > e.clientHeight + 20;
    }).sort((a, b) => b.scrollHeight - a.scrollHeight)[0];
    if (!el2) return res();
    const start = el2.scrollTop, end = (el2.scrollHeight - el2.clientHeight) * frac, t0 = performance.now();
    const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
    const step = (now) => { const p = Math.min(1, (now - t0) / ms); el2.scrollTop = start + (end - start) * ease(p); if (p < 1) requestAnimationFrame(step); else res(); };
    requestAnimationFrame(step);
  });
}

async function pass1Seed() {
  const ctx = await chromium.launchPersistentContext(PROFILE, { viewport: { width: VW, height: VH } });
  const page = ctx.pages()[0] ?? await ctx.newPage();
  await page.addInitScript(() => { if (!('showDirectoryPicker' in window)) window.showDirectoryPicker = () => Promise.reject(new Error('stub')); });
  await page.goto(APP_URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    localStorage.setItem('storageMode', 'idb');
    localStorage.setItem('timelines_welcome_created', '1');
  });
  await page.reload({ waitUntil: 'networkidle' });
  await sleep(400);
  const seeded = await page.evaluate(seedData);
  await sleep(300);
  await ctx.close();
  return seeded.id;
}

async function pass2Record(timelineId) {
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    viewport: { width: VW, height: VH },
    deviceScaleFactor: 2,
    recordVideo: { dir: RAW_DIR, size: { width: VW, height: VH } },
  });
  const page = ctx.pages()[0] ?? await ctx.newPage();
  const recordStart = Date.now(); // video recording begins ~here
  await page.addInitScript(() => { if (!('showDirectoryPicker' in window)) window.showDirectoryPicker = () => Promise.reject(new Error('stub')); });

  await page.goto(APP_URL + '#/timelines/' + timelineId, { waitUntil: 'networkidle' });
  await page.locator('.ProseMirror, [class*="card"]').first().waitFor({ timeout: 8000 }).catch(() => {});
  await page.evaluate(installOverlay);

  const card = (k, h, p) => page.evaluate(([k, h, p]) => window.__card(k, h, p), [k, h, p]);
  const hide = () => page.evaluate(() => window.__hide());
  const hero = (svg) => page.evaluate((svg) => window.__hero(svg), svg);
  const heroHide = () => page.evaluate(() => window.__heroHide());
  const scrollFrac = (frac, ms) => page.evaluate(([frac, ms]) => window.__scrollFrac(frac, ms), [frac, ms]);
  const intertitle = async (k, h, p, ms = 4000) => { await card(k, h, p); await sleep(ms); await hide(); await sleep(420); };

  // Wait for Fraunces to load so the hero wordmark renders correctly from frame
  // one (no font swap). This happens behind nothing yet and is trimmed away.
  await page.evaluate(() => document.fonts.load("600 108px 'Fraunces'").catch(() => {}));
  await sleep(500);

  // ===== Walkthrough =====================================================
  // Static hero opening (logo + wordmark + tagline), mirroring the site hero,
  // held 5s with no animation. Everything before it is trimmed at encode so the
  // video opens directly on this frame.
  const leadSec = Math.max(0, (Date.now() - recordStart) / 1000 + 0.05);
  await hero(LOGO_SVG);
  await sleep(5000);

  // Action 1 — browse a rich entry. Prepare the Step 1 card behind the hero,
  // then remove the hero for a clean cut (no app flash). Reset to the top, then
  // glide all the way down to the editor so Step 2 needs no scrolling.
  await card('', 'Browse a timeline', 'Rich-text entries — headings, tables, checklists, attachments.');
  await scrollFrac(0, 100);
  await sleep(450);
  await heroHide();
  await sleep(3600);
  await hide();
  await sleep(420);
  await scrollFrac(1.0, 5000);
  await sleep(900);

  // Action 2 — add a note. The editor is already in view from Step 1, so after
  // a short pause go straight into typing (no scrolling here).
  await intertitle('', 'Add a note', 'Type, format, and save in seconds.');
  await sleep(700);
  const editor = page.locator('.ProseMirror').first();
  await editor.click();
  await sleep(300);
  await page.keyboard.type('Met the supplier on site — ', { delay: 32 });
  await page.keyboard.down('Control'); await page.keyboard.press('KeyB'); await page.keyboard.up('Control');
  await page.keyboard.type('delivery confirmed', { delay: 32 });
  await page.keyboard.down('Control'); await page.keyboard.press('KeyB'); await page.keyboard.up('Control');
  await page.keyboard.type(' for the 22nd.', { delay: 32 });
  await sleep(600);
  await page.getByRole('button', { name: 'Save' }).click().catch(() => {});
  await sleep(400);
  await scrollFrac(1.0, 500);
  const added = await page.evaluate(() => [...document.querySelectorAll('[class*="card"]')].some((c) => c.textContent?.includes('Met the supplier')));
  console.log('  entry added:', added);
  await sleep(1100);

  // Action 3 — track follow-ups
  await intertitle('', 'Track follow-ups', 'Due dates roll up into the Todos page, grouped by urgency.');
  await page.getByRole('button', { name: 'Todos' }).first().click().catch(() => {});
  await sleep(900);
  await scrollFrac(0.4, 1300);
  await sleep(1000);

  // Outro card — end on the message.
  await card('', 'No account. No server.', 'Your data stays on your device.');
  await sleep(2500);

  await ctx.close();
  return leadSec;
}

async function main() {
  const id = await pass1Seed();
  const leadSec = await pass2Record(id);

  const rawName = readdirSync(RAW_DIR).find((f) => f.endsWith('.webm'));
  if (!rawName) throw new Error('no video produced');
  const rawPath = join(RAW_DIR, rawName);

  const FF = FF_CANDIDATES.find((p) => p === 'ffmpeg' || existsSync(p));
  const mp4 = resolve(OUT_DIR, 'organizer-demo.mp4');
  const webm = resolve(OUT_DIR, 'organizer-demo.webm');
  for (const f of [mp4, webm]) if (existsSync(f)) rmSync(f);
  const LEAD = leadSec.toFixed(2); // trim everything before the hero opening
  const VF = 'scale=1920:1080:flags=lanczos'; // upscale ×1.25 → fixed 125% look
  console.log('  trimming lead:', LEAD + 's');
  if (!FF) { console.warn('\nNo ffmpeg found; raw webm left in', RAW_DIR); return; }
  // Both encodes start from the same raw with the SAME -ss trim, so the mp4 and
  // webm are frame-identical — no extra lead-in on one versus the other.
  execFileSync(FF, [
    '-y', '-ss', LEAD, '-i', rawPath, '-vf', VF,
    '-movflags', '+faststart', '-pix_fmt', 'yuv420p',
    '-c:v', 'libx264', '-crf', '20', '-preset', 'slow', '-r', '30', '-an',
    mp4,
  ], { stdio: 'inherit' });
  console.log('Wrote', mp4);
  execFileSync(FF, [
    '-y', '-ss', LEAD, '-i', rawPath, '-vf', VF,
    '-c:v', 'libvpx-vp9', '-crf', '34', '-b:v', '0', '-row-mt', '1',
    '-deadline', 'good', '-cpu-used', '4', '-r', '30', '-an',
    webm,
  ], { stdio: 'inherit' });
  console.log('Wrote', webm);
  rmSync(RAW_DIR, { recursive: true, force: true });
}

main().catch((e) => { console.error(e); process.exit(1); });

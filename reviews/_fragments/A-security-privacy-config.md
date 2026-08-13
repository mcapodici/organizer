Review complete. Fragment written to `reviews/_fragments/A-security-privacy-config.md`. Full findings below.

# Fragment A — Security, Privacy & Config

Read-only review. No source files changed.

## 1) SECURITY

### [Severity: High] Untrusted import JSON parsed and rendered with zero validation
- Evidence: `src/utils/exportImport.ts:40-41` — `const data: ExportData = JSON.parse(text);`; the result is trusted wholesale and written to storage (`:61-69`). The type is a compile-time cast (`src/types.ts:30-35`), no runtime check.
- Why it matters: Import is the one channel where outside data enters a local-first app. A hostile/malformed file can crash the importer mid-loop (after `replace` deletes already ran at `:47-51`, leaving storage half-wiped) or plant an `entry.content` string later rendered as raw HTML. `zod ^4.4.3` is installed but used **nowhere** (`grep -rn "zod" src/` is empty) — the right tool is idle.
- Trade-offs / options: full zod schema (must move zod to `dependencies` to ship) vs hand-rolled guards (no dep churn, verbose) vs staging deletes after validation (fixes half-wipe independently).
- Suggested direction: Promote zod to a runtime dep, validate before any write, and stage validation before destructive `replace` deletes.

### [Severity: High] `dangerouslySetInnerHTML` fallback renders raw entry content
- Evidence: `src/components/EntryCard/EntryCard.tsx:34-46` — on `JSON.parse` failure `html = entry.content` (unsanitised), then injected at `:132-136`.
- Why it matters: Happy path is schema-constrained via `generateHTML`, but the `catch` dumps the raw string into `__html`. Combined with the unvalidated importer, an attacker crafts content that isn't valid JSON (hits `catch`) with an `<img onerror=...>` payload → executes in the app origin, reads the whole journal. No CSP to stop it.
- Trade-offs / options: render fallback as text (tiny, closes vector) vs DOMPurify (defence in depth, adds dep). Also verify the bare `Link` (`:5,39`) keeps TipTap's default `javascript:` protocol allowlist.
- Suggested direction: Make the `catch` branch render text, never HTML.

### [Severity: High] No CSP or security headers on the deployed app
- Evidence: `vercel.json:9-23` sets only SW/cache/manifest headers — no CSP, `X-Content-Type-Options`, `Referrer-Policy`, or `frame-ancestors`.
- Why it matters: CSP is the backstop that would downgrade the two XSS findings from full-data-compromise to blocked-script.
- Trade-offs / options: strict CSP (must allow `blob:`/`data:` for attachment object URLs at `EntryCard.tsx:202`, plus analytics `connect-src`) vs report-only first vs a minimal header set now.
- Suggested direction: Ship `nosniff`/`Referrer-Policy`/`frame-ancestors` now; develop a strict CSP report-only against preview, then enforce.

### [Severity: Medium] Dependency vulnerabilities — 13 reported (9 high), mostly dev tooling
- Evidence: `npm audit` → `13 vulnerabilities (2 low, 2 moderate, 9 high)`. Runtime-path: `vite ^8.0.10` (`package.json:74`), `react-router-dom ^7.15.0` (`:46`, RSC CSRF — **not** exploitable here, app is client-only `HashRouter` at `main.tsx:22`). Rest are dev/transitive (vitepress/esbuild, nanoid, postcss, brace-expansion, shell-quote via concurrently, undici, @babel).
- Suggested direction: `npm audit fix`, then explicitly bump `vite`/`react-router-dom`, re-run `scripts/check.sh`; treat dev-only transitives as documented noise.

### Looks OK — Security
- `.env.local` not tracked (gitignored twice); holds only a short-lived `VERCEL_OIDC_TOKEN`. SW registration is PROD-gated + `/app/`-scoped with `no-cache` `sw.js`. Composer link is `openOnClick: false`. Workbox caches only same-origin assets with bounded expiry.

## 2) PRIVACY / DATA GOVERNANCE

### [Severity: High] @vercel/analytics contradicts the "data never leaves your device" promise, undisclosed
- Evidence: mounted unconditionally at `src/main.tsx:4,31` with no consent gate. Contradicts `README.md:6`, `docs/guide/storage-and-backup.md:3-4` ("Your data never leaves your device"), `docs/index.md:61-62`, and `docs/blog/posts/why-organizer-is-local-first.md:115` ("no third party sitting between you and [your data]"). A docs grep for analytics/telemetry/cookie finds **no disclosure** anywhere.
- Why it matters: The component sends page path/referrer/coarse device+geo to a third party. Journal content stays local, but "no server, no third party" is now literally false and invisible to users — a trust/truth-in-advertising problem.
- Trade-offs / options: remove entirely (restores promise) vs opt-in default-off + disclose vs soften the docs copy.
- Suggested direction: Given how load-bearing the claim is, remove `<Analytics />` (or make it strictly opt-in) rather than dilute the promise; disclose if any stays.

### Looks OK — Privacy
- Journal data is genuinely local (export is a client-side Blob download at `exportImport.ts:30-36`; no network write path). No other beacons/trackers in `src/`.

## 3) BUILD, DEPLOY & CONFIG

### [Severity: Medium] `.vercelignore` far narrower than `.gitignore` — local secrets/scratch upload to build context
- Evidence: `.vercelignore` excludes only `.ffmpeg/ .demo-* node_modules/ dist/`. It does **not** exclude `.env.local` (holds the OIDC token), `.pipeline.log` (310 KB), `.git/`, or the `.backlog/.llm/.hermes/.claude/.atomic` scratch. Vercel uses this file, not `.gitignore`, to decide uploads.
- Why it matters: `.env.local` and logs get packed into every `vercel deploy` upload (not served, but a credential file shipped to a remote build context; also bloat).
- Suggested direction: Mirror `.env*`, `*.log`, `.git/`, and local tool dirs into `.vercelignore`.

### [Severity: Low] Production deploy skips lint and the full check suite
- Evidence: `scripts/deploy.sh` runs only `tsc --noEmit` + `npm test` before `--prod`; the preview script runs full `scripts/check.sh` (`deploy-preview.sh:17-18`).
- Suggested direction: Have `deploy.sh` call `scripts/check.sh` so prod is never a weaker gate than preview.

### [Severity: Low] Node matrix documented but `engines` broad while `mise` pins 26
- Evidence: `package.json:6-8` `>=22`; `mise.toml` pins 26 with the `localStorage` shim documented in `AGENTS.md`/`src/test-setup.ts`. Deliberate and handled; only risk is an untested future major auto-selected by `>=22`.
- Suggested direction: Optionally cap to `>=22 <27`.

### Looks OK — Build/Deploy/Config
- `.env.local`, `dist`, `.pipeline.log` all confirmed **not tracked**. `.vercelignore` correctly drops the ~600 MB ffmpeg/demo dirs. Vite `base:'/app/'` + `outDir:'dist/app'` split is coherent with `vercel.json outputDirectory:dist`. PWA manifest complete; `sw.js` `no-cache` pairs correctly with `autoUpdate`. `check.sh` is `set -euo pipefail`, fails fast, covers lint/tests/tsc/docs/app build.

## Top 3 priorities for this fragment
1. **Close the import→render XSS chain (High):** validate imported JSON (promote installed `zod` to runtime) and stop `EntryCard.tsx:44-46` from injecting raw `entry.content` as HTML.
2. **Resolve analytics-vs-privacy contradiction (High):** `@vercel/analytics` (`main.tsx:31`) sends usage data to a third party against the explicit docs promise — remove or make opt-in and disclose.
3. **Add security headers/CSP and tighten `.vercelignore` (Medium):** no CSP backstop in `vercel.json`; `.vercelignore` uploads `.env.local`/logs to the build context.
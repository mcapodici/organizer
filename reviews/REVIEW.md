The combined review is assembled and written to `reviews/REVIEW.md`. Below is the complete document.

---

# Organizer — Combined Deep-Dive Review

## Scope

This document consolidates five independent research passes over the **Organizer** codebase — a local-first timeline/journal PWA (React 19 + Vite + TipTap + IndexedDB/OPFS storage adapters + vite-plugin-pwa, docs in VitePress, deployed to Vercel, tested with Vitest + Testing Library + fake-indexeddb). The review covers thirteen angles spanning security, UX, accessibility, data integrity, performance, testing, type safety, error handling, architecture, docs, build/deploy, and privacy. **No source files were changed** — this is a read-only assessment; the only file written is this document. Date: **2026-08-13**.

## How to read this

- **Severity scale** (impact × likelihood): **Critical** (user-visible data loss / broken core promise, fix immediately) → **High** (security or correctness defect with a realistic trigger) → **Medium** (real problem, some mitigation or narrower blast radius) → **Low** (polish, hygiene, or latent risk).
- **Per-finding format**: each carries **Evidence** (`file:line`), **Why it matters**, **Trade-offs / options**, and a **Suggested direction**. Some Low items are compressed to a single line where the fragment kept them terse.
- **"Looks OK" notes** are preserved per angle — they record things that were checked and found sound, so the absence of a finding is deliberate, not an oversight.
- **Deduplication**: a few defects surface from multiple angles (notably the "Clear all data" no-op and the analytics-vs-privacy contradiction). The fullest version is kept in its primary angle and cross-referenced from the others.

---

## Executive summary

| Priority | Angle | Finding | Severity |
|---|---|---|---|
| 1 | Usability / UX | "Clear all data" deletes nothing — inert button + misleading modal | Critical |
| 2 | Security | Untrusted import JSON parsed and rendered with zero validation | High |
| 3 | Security | `dangerouslySetInnerHTML` fallback renders raw entry content (XSS) | High |
| 4 | Privacy | `@vercel/analytics` contradicts "data never leaves your device", undisclosed | High |
| 5 | Data integrity | Corrupt OPFS file wedges the whole app permanently | High |
| 6 | Error handling | IDB write failures (incl. QuotaExceeded) swallowed silently | High |
| 7 | Error handling | "Unable to save" modal promises an auto-retry that never happens | High |
| 8 | Accessibility | Search results unreachable by keyboard | High |
| 9 | Accessibility | Modal has no focus management or focus trap | High |
| 10 | Type safety | TypeScript `strict` mode is OFF (no `strictNullChecks`) | High |
| 11 | Performance | `EntryCard` rebuilds full TipTap HTML every render; no memo/virtualization | High |
| 12 | Docs accuracy | README describes a storage architecture that no longer exists | High |
| 13 | Security | No CSP or security headers on the deployed app | High* |
| 14 | Testing | Core surfaces (Settings, TimelineView, EntryComposer, StorageContext) untested | High |
| 15 | Data integrity | Destructive `replace` import is non-atomic (half-wipe on failure) | Medium→High |

\* Severity Medium in the source fragment; elevated in priority because it is the backstop for findings 2–3.

---

## Security

### [High] Untrusted import JSON parsed and rendered with zero validation
- **Evidence:** `src/utils/exportImport.ts:40-41` — `const data: ExportData = JSON.parse(text);`; the result is trusted wholesale and written to storage (`:61-69`). The type is a compile-time cast (`src/types.ts:30-35`); no runtime check.
- **Why it matters:** Import is the one channel where outside data enters a local-first app. A hostile/malformed file can crash the importer mid-loop (after `replace` deletes already ran at `:47-51`, leaving storage half-wiped) or plant an `entry.content` string later rendered as raw HTML. `zod ^4.4.3` is installed but used **nowhere** (`grep -rn "zod" src/` is empty) — the right tool is idle.
- **Trade-offs / options:** full zod schema (must move zod to `dependencies` to ship) vs hand-rolled guards (no dep churn, verbose) vs staging deletes after validation (fixes half-wipe independently).
- **Suggested direction:** Promote zod to a runtime dep, validate before any write, and stage validation before destructive `replace` deletes.
- *Cross-ref:* Type safety (same cast) and Data integrity (non-atomic `replace`, missing-array crash).

### [High] `dangerouslySetInnerHTML` fallback renders raw entry content
- **Evidence:** `src/components/EntryCard/EntryCard.tsx:34-46` — on `JSON.parse` failure `html = entry.content` (unsanitised), then injected at `:132-136`.
- **Why it matters:** The happy path is schema-constrained via `generateHTML`, but the `catch` dumps the raw string into `__html`. Combined with the unvalidated importer, an attacker crafts content that isn't valid JSON (hits `catch`) carrying an `<img onerror=...>` payload → executes in the app origin and reads the whole journal. No CSP to stop it.
- **Trade-offs / options:** render the fallback as text (tiny, closes the vector) vs DOMPurify (defence in depth, adds a dep). Also verify the bare `Link` (`:5,39`) keeps TipTap's default `javascript:` protocol allowlist.
- **Suggested direction:** Make the `catch` branch render text, never HTML.

### [High] No CSP or security headers on the deployed app
- **Evidence:** `vercel.json:9-23` sets only SW/cache/manifest headers — no CSP, `X-Content-Type-Options`, `Referrer-Policy`, or `frame-ancestors`.
- **Why it matters:** CSP is the backstop that would downgrade the two XSS findings above from full-data-compromise to blocked-script.
- **Trade-offs / options:** strict CSP (must allow `blob:`/`data:` for attachment object URLs at `EntryCard.tsx:202`, plus an analytics `connect-src`) vs report-only first vs a minimal header set now.
- **Suggested direction:** Ship `nosniff` / `Referrer-Policy` / `frame-ancestors` now; develop a strict CSP report-only against preview, then enforce.

### [Medium] Dependency vulnerabilities — 13 reported (9 high), mostly dev tooling
- **Evidence:** `npm audit` → `13 vulnerabilities (2 low, 2 moderate, 9 high)`. Runtime-path: `vite ^8.0.10` (`package.json:74`), `react-router-dom ^7.15.0` (`:46`, RSC CSRF — **not** exploitable here, the app is client-only `HashRouter` at `main.tsx:22`). The rest are dev/transitive (vitepress/esbuild, nanoid, postcss, brace-expansion, shell-quote via concurrently, undici, @babel).
- **Suggested direction:** `npm audit fix`, then explicitly bump `vite`/`react-router-dom`, re-run `scripts/check.sh`; treat dev-only transitives as documented noise.

### Looks OK — Security
- `.env.local` not tracked (gitignored twice); holds only a short-lived `VERCEL_OIDC_TOKEN`. SW registration is PROD-gated + `/app/`-scoped with `no-cache` `sw.js`. Composer link is `openOnClick: false`. Workbox caches only same-origin assets with bounded expiry.

---

## Usability / UX

### [Critical] "Clear all data" deletes nothing
- **Evidence:** `src/components/Settings/Settings.tsx:39-42` — `handleReset` only calls `setResetModalOpen(false)` and `navigate('/')`. The modal (`Settings.tsx:155-167`) promises permanent deletion of all timelines/entries/attachments. Proof no bulk-clear even exists: `src/storage/interface.ts` exposes only `deleteTimeline`, `deleteEntry`, `deleteEntriesForTimeline`, `deleteBlob` — no `clearAll`; and `StorageContext.tsx:97` notes `resetStorage` is intentionally omitted.
- **Why it matters:** Users believe their data is wiped (e.g. before sharing a device) but everything stays on disk — a privacy/trust failure.
- **Trade-offs / options:** (1) implement a real `clearAll()` across both adapters and call it; (2) short-term remove/disable the button.
- **Suggested direction:** Option 1; if it can't ship now, take option 2 rather than keep the deceptive button.
- *Cross-ref:* This single defect also surfaces as a Testing gap (no Settings test would catch it — Fragment E) and a Docs mismatch (`storage-and-backup.md` promises the wipe — see Docs accuracy). It is the highest-priority item overall.

### [High] Search results unreachable by keyboard
- **Evidence:** `SearchBox.tsx:144-148` binds selection only to `onMouseDown` (no `onClick`, no arrow-key/combobox handling). Tabbing to a result and pressing Enter fires `click`, not `mousedown` → nothing happens.
- **Why it matters:** Search is a primary nav surface; keyboard/SR users can't open any result.
- **Trade-offs / options:** (1) add `onClick` alongside `onMouseDown`; (2) full combobox with listbox/option roles + arrow keys.
- **Suggested direction:** Option 1 now, option 2 later.
- *Cross-ref:* Accessibility.

### [Medium] Timeline title edit is mouse-only
- **Evidence:** `TimelineView.tsx:135-137` — rename triggered by clicking a bare `<h1>` (no tabIndex, no key handler, no affordance). Rename is also reachable via the sidebar kebab, so not a total block.
- **Suggested direction:** Add an explicit edit button matching the existing "Edit tags" pattern.

### [Medium] Image lightbox can't be closed by keyboard
- **Evidence:** `EntryCard.tsx:144-148` overlay closes on click only (no Escape, not focused, no dialog role); the opener is an `<img onClick>` (`:214-220`), not a button.
- **Suggested direction:** Route the lightbox through the shared `Modal` and promote the thumbnail to a button.

### [Low] Emoji/text glyphs as UI chrome (violates UI_STANDARDS #5)
- **Evidence:** `Modal.tsx:31`, `EntryComposer.tsx:275,313,362,369`, `TimelineView.tsx:145`, `Toast.tsx:54` use `✕`/`×`/`✎`/`+` while UndoBar/Settings use lucide icons.
- **Suggested direction:** Standardize on lucide `X`.

### [Low] Toast bypasses design tokens (violates UI_STANDARDS #1)
- **Evidence:** `Toast.tsx:36-52` hard-codes `#fff`/`#e5e7eb`/`#111827`/`#6b7280`/`#9ca3af` instead of the tokens defined in `index.css:23-42`.
- **Suggested direction:** Extract a `Toast.module.css` using tokens.

### Looks OK — Usability
- Undo lands writes immediately then offers a 10s revert (`App.tsx:100-114`, `TodoPage.tsx:98-112`).
- Import replace/merge confirm names the file (`Settings.tsx:133-153`).
- Thoughtful empty states (`App.tsx:329-360`, `TodoPage.tsx:133-143`).
- Hover-only entry actions have a `@media (hover: none)` fallback (`EntryCard.module.css:81-86`) per UI_STANDARDS #4.
- Composer preserves/restores an in-progress draft (`EntryComposer.tsx:84-130`); Save disabled when empty/saving.
- Copy-into-draft guards unsaved work (`TimelineView.tsx:174-180`).

---

## Dead code

### [Medium] `AppBanner` component + CSS unused
- **Evidence:** only self-references (proven by grep).
- **Suggested direction:** Remove the component and its CSS.

### [Medium] Dead interface surface — `mergeConflictFiles` and `duplicatedEntryId`
- **Evidence:** never consumed at runtime (proven by grep); both `mergeConflictFiles` implementations are zero stubs. `mergeForeignState` (`merge.ts:34`) is dead in production — only its definition and tests reference it.
- **Suggested direction:** Prune the unused interface members, or wire them to a real consumer if planned.
- *Cross-ref:* Architecture (dead interface surface) and Data integrity (`mergeForeignState` dead).

### [Low] `showNudge = false` makes the export-nudge branch unreachable
- **Evidence:** the constant is hard-`false`, so the branch never renders.
- **Suggested direction:** Remove or re-enable intentionally.

### [Low] `zod` dependency unused anywhere
- **Evidence:** `grep -rn "zod" src/` is empty despite `zod ^4.4.3` being installed.
- **Suggested direction:** Either put zod to work validating imports (see Security / Type safety) or drop it.

### [Low] OPFS `importedCount` is structurally always 0
- **Evidence:** `opfsAdapter.ts:188` computes the count after `this.entries` is already rebuilt.
- *Cross-ref:* Data integrity ("OPFS `importedCount` is always ~0") holds the full write-up.

---

## Accessibility

### [High] Modal has no focus management or focus trap
- **Evidence:** `Modal.tsx:10-37` sets `role="dialog"`/`aria-modal`/Escape but never focuses the dialog on open, never restores focus on close, and never traps Tab (the `ref` is used only for `stopPropagation`). Affects every modal.
- **Why it matters:** `aria-modal="true"` claims the background is inert, yet focus stays behind it and Tab escapes.
- **Suggested direction:** Add focus-on-open, a Tab trap, and focus restore in the shared `Modal`.

### [High] Search results unreachable by keyboard
- See **Usability / UX** for the full write-up (`SearchBox.tsx:144-148`, `onMouseDown`-only binding). Listed here because it is equally an accessibility defect.

### [Medium] Todo card uses nested-interactive `role="button"`
- **Evidence:** `TodoPage.tsx:224-262` — a `role="button"` div contains a real `<button>` (due-date editor) + popover; the key handler fires only on Enter, not Space.
- **Suggested direction:** Restructure so navigation and due-date editing are sibling controls, using an `<a>`/`<button>` for navigation.

### [Medium] Overdue badge distinguished by color alone
- **Evidence:** `TimelineList.tsx:116-120` + `TimelineList.module.css:187-189` (and `App.tsx:338-341`) — same count number, only the red background differs, no `aria-label`. WCAG 1.4.1.
- **Suggested direction:** Add an `aria-label` (e.g. "3 todos, 2 overdue") plus a non-color glyph.

### [Low] Composer date/time inputs lack a programmatic name
- **Evidence:** `EntryComposer.tsx:261-278` — the datetime input's only label sibling is the `✕` button; the due-date block (`:289-315`) wraps several controls in one ambiguous `<label>`.
- **Suggested direction:** Add an explicit `aria-label` per input.

### [Low] Attachment thumbnails non-semantic; generic alt
- **Evidence:** `EntryCard.tsx:214-221` — clickable `<img>` (no keyboard access); the lightbox alt is `"Full size"` (`:146`) though `attachment.name` is available.
- **Suggested direction:** Button-wrap the thumbnail; derive alt from the attachment name.

### Looks OK — Accessibility
- Global `:focus-visible` (`index.css:80-83`); every `outline: none` pairs with a replacement ring — UI_STANDARDS #2 met.
- `prefers-reduced-motion` guard incl. `scroll-behavior` (`index.css:86-93`) — #6 met.
- Icon-only controls carry `aria-label` (burger, kebab, todo check, expand, dismiss, resizer with `role="separator"` + arrow-key resize).
- Toasts `role="status"`, never auto-dismiss (`Toast.tsx:23-35`).
- UndoBar labels via `role="status"`, countdown `aria-hidden` (`UndoBar.tsx:35-36`).
- `DueDatePopover` is a proper dialog with Escape/outside-click/scroll dismiss and viewport flip.
- Decorative logos `alt=""`; the meaningful brand logo `alt="Organizer"`.

---

## Data integrity & persistence

### [High] Corrupt OPFS entry/timeline file wedges the whole app permanently
- **Evidence:** `src/storage/opfsAdapter.ts:161-162` and `:236-238` do unguarded `JSON.parse` on stored text; `scanWorkspace` (`:87-92`) only catches `readText` failures, not parse failures.
- **Why it matters:** One readable-but-invalid JSON file makes `getAllEntries()` reject → `useEntries.reload` throws → the timeline never renders. If the poll hits `mergeFromDisk`, the parse rejects into `runMerge`'s empty catch (`StorageContext.tsx:128`) and retries every 2s forever while `frozen`, rejecting all writes. Silent and permanent.
- **Suggested direction:** Parse defensively at scan time, quarantine bad files, and surface a count.

### [High] OPFS `importedCount` is always ~0
- **Evidence:** `opfsAdapter.ts:167-188` — `this.entries` is rebuilt from `outcome.entries` before `importedCount: outcome.entries.length - this.entries.size` is computed, so it is always 0.
- **Suggested direction:** Return an explicit count from `mergeDiskState` (as `mergeForeignState` already does).

### [Medium] IDB merge count is a constant, not a real count
- **Evidence:** `idbAdapter.ts:59,63` return `1`/`0`. The toast number means different things across backends.

### [Medium] Import ignores `version`; blobs always overwrite
- **Evidence:** `exportImport.ts:41` never inspects `data.version`; `:67-68` overwrites blobs even in merge mode where entries are skipped.

### [Medium→High] `replace` import is destructive and non-atomic
- **Evidence:** `exportImport.ts:43-52` wipes, then `:61-69` writes; no transaction/rollback; `Settings.tsx:29-36` only resets UI flags. A malformed file or a quota error mid-import leaves a half-empty workspace with no message.
- **Suggested direction:** Validate fully before deleting; report failures. (This is the same half-wipe risk flagged under Security's import-validation finding.)

### [Medium] Import crashes on a missing `timelines`/`entries` array
- **Evidence:** `exportImport.ts:61-66` iterate unguarded; only `blobs` has `|| {}` (`:67`).

### [Low] `mergeForeignState` is dead in production
- **Evidence:** grep across `src/` and `docs/` finds only the definition (`merge.ts:34`) and its tests; both `mergeConflictFiles` are zero stubs.
- *Cross-ref:* Dead code / Architecture.

### [Low] Timestamp ordering assumes one canonical ISO form
- **Evidence:** `useEntries.ts:15`, `useTimelines.ts:19`, `merge.ts:19-23` all use string compare — breaks on mixed offsets/precision from imported data.

### Looks OK — Data integrity
- `mergeDiskState` draft-vs-disk logic, `revertTodoFields` field-scoping, UUID id generation, OPFS entry-move deletion, additive IDB migrations, and stable-sort tie handling are all correct and tested.

---

## Performance

### [High] `EntryCard` rebuilds full TipTap HTML every render
- **Evidence:** `EntryCard.tsx:34-46` calls `generateHTML` (full ProseMirror schema) in the render body with no `useMemo`; `TimelineView.tsx:151-162` maps every entry with no `React.memo`. The 2s merge poll re-renders the whole tree.
- **Suggested direction:** Memoize the generated HTML per entry; wrap `EntryCard` in `React.memo`.

### [High] Timeline is not virtualized
- **Evidence:** `TimelineView.tsx:150-163` and `TimelineList.tsx:107-145` render full `.map()`s; grep for `react-window`/`virtual`/`tanstack` finds nothing. Every attachment also opens a blob + object URL on mount.
- **Suggested direction:** Introduce list virtualization; lazy-load attachment object URLs.

### [Medium] Context values unmemoized
- **Evidence:** `StorageContext.tsx:165` and `UndoContext.tsx:70` pass fresh object literals; `markSaved` isn't `useCallback`.

### [Medium] `getAllEntries()` full scans
- **Evidence:** on todo counts (`useTodoCounts.ts`), TodoPage, and SearchBox (rescored on every keystroke).

### [Low] TipTap loaded eagerly, no `manualChunks`.

### Looks OK — Performance
- lucide named imports tree-shake, `useTags` memoized, PWA cache strategy sound, object URLs revoked.

---

## Testing & quality

### Test inventory (21 test files)
- **Components WITH tests (5):** EntryCard, SearchBox, TagFilter, TagInput, TodoPage.
- **Components WITHOUT tests (9):** AppBanner, DueDatePopover, EntryComposer (only its `linkExtension.ts` helper is tested, not the 399-line editor), Modal, Settings, TimelineList, TimelineView, Toast, UndoBar.
- **Hooks:** all four tested. **Context:** UndoContext tested; **StorageContext has no test.**
- **Utils WITHOUT tests:** `welcome.ts`. **Storage/db:** well covered.

### [High] The brief's premise is partly stale — SearchBox *is* tested; the real gaps are Settings, TimelineView, TimelineList, EntryComposer, DueDatePopover
- **Evidence:** `src/components/SearchBox/SearchBox.test.tsx:39` has 4 real cases. Zero-test files: `Settings.tsx` (173 lines), `TimelineView.tsx` (225), `TimelineList.tsx` (216), `EntryComposer.tsx` (399), `DueDatePopover.tsx` (155).
- **Why it matters:** TimelineView/EntryComposer/Settings are core surfaces (create/edit/delete, attachments, destructive actions). Regressions land silently.
- **Trade-offs / options:** prioritise by blast radius (Settings/TimelineView/DueDatePopover first) vs by complexity (EntryComposer first, but TipTap is brittle in jsdom) vs thin smoke tests everywhere (fast but shallow).
- **Suggested direction:** Behavior tests for Settings, DueDatePopover, TimelineView first via the existing `FakeAdapter`; defer deep EntryComposer coverage.

### [High] "Clear all data" deletes nothing — a bug an absent Settings test would have caught
- **Evidence:** `Settings.tsx:39` — `handleReset` only `setResetModalOpen(false)` + `navigate('/')`; never calls any delete. The "Clear everything" button (`:165`) is wired to it. `grep` in `Settings/` for delete/clear calls returns only label strings. `StorageContext.tsx:97-98` even claims users clear data here — but the path is inert.
- **Suggested direction:** Add the emptiness-asserting Settings test when the bug is fixed (it fails today, pinning the bug).
- *Cross-ref:* This is the **Critical** Usability finding; the code fix lives there.

### [Medium] StorageContext (safety-critical seam) has no test, and every consumer mocks it away
- **Evidence:** no `StorageContext.test.tsx`; `App.test.tsx:13`, `SearchBox.test.tsx:9`, `useEntries.test.tsx:7`, `TodoPage.test.tsx:10` all `vi.mock` it. Untested: OPFS/IDB boot selection (`StorageContext.tsx:83-88`), the 2s auto-merge poll (`108-148`), `withErrorCapture` (`24-55`), the write-error modal (`167-217`).
- **Why it matters:** This code decides where data lives and silently merges concurrent edits — regressions here risk invisible data loss.
- **Suggested direction:** A focused provider test with `vi.useFakeTimers()` asserting a conflicting adapter triggers merge + toast on a poll tick.

### [Medium] Brittle wait in SearchBox test — real `setTimeout(50)` then negative assertion
- **Evidence:** `SearchBox.test.tsx:70` `await new Promise((r) => setTimeout(r, 50))` before `queryByText(...).toBeNull()`.
- **Why it matters:** A fixed wall-clock delay before a negative assertion is racy on slow CI and silently breaks if the debounce grows. Every other timing test uses fake timers (`UndoContext.test.tsx:8,36`).
- **Suggested direction:** Prefer a positive "no results" signal via `findBy`; else drive with fake timers.

### [Medium] Playwright is a devDependency but there is no e2e coverage
- **Evidence:** `package.json:52,70`; grep finds `playwright` only in `scripts/record-demo.mjs:16` and `seed-and-shoot.mjs:10` (docs screenshots). No `*.spec.ts`, no `playwright.config.*`. `check.sh` runs only vitest.
- **Why it matters:** OPFS, the PWA service worker, export download, and real `contentEditable` can't run in jsdom; `@playwright/test` sits unused, implying unrealized intent.
- **Suggested direction:** Commit to a tiny smoke suite or remove the unused dep — don't leave it ambiguous.

### [Low] No coverage gate despite `@vitest/coverage-v8` installed
- **Evidence:** `package.json:61`; no `coverage` script; `vite.config.ts:131-139` sets no thresholds.
- **Suggested direction:** Add a `coverage` script + modest thresholds scoped to `storage/` and `context/`.

### [Low] Comment drift in the trap guard test
- **Evidence:** `test-setup.test.ts:4` says "Node 24+", but `test-setup.ts:9` and AGENTS.md say 24 is unaffected, only 26+.
- **Suggested direction:** Change the comment to "Node 26+".

### Looks OK — Testing
- The localStorage/jsdom trap is handled well (`test-setup.ts:51-71` probes the inert getter; `test-setup.test.ts` guards spec behavior). `FakeAdapter` implements the full interface — proportionate, not over-mocking. UndoContext uses fake timers correctly. Storage/merge is the best-covered area. `check.sh --no-file-parallelism` + `pool: 'threads'` is deliberate and documented.

---

## Type safety

### [High] `strict` mode is OFF
- **Evidence:** no `strict`/`extends` in any tsconfig, so `strictNullChecks` is disabled and every `!` (`this.root!`, `dueDate!`) is unverified.
- **Suggested direction:** Enable `strict`, then work through the fallout; the pervasive `!`/`as` casts (below) become checked.

### [Medium] Untrusted `JSON.parse(...) as ExportData` on import with no validation
- **Evidence:** `exportImport.ts:41` — `zod` is installed but unused.
- *Cross-ref:* Security's import-validation finding holds the full write-up and the XSS chain.

### [Low] Pervasive `!` / `as` casts standing in for null checks.

### Looks OK — Type safety
- **Zero `any`**, clean `types.ts`/`global.d.ts`, ESLint enforces no-explicit-any with `--max-warnings 0`.

---

## Error handling & resilience

### [High] IDB write failures (incl. QuotaExceededError) are swallowed
- **Evidence:** `StorageContext.tsx:136-138` gives IDB a no-op `onError`; `withErrorCapture` (`:29-36`) still rethrows, so the rejection bubbles to an uncaught `onClick` with no UI — a silent lost save.
- **Suggested direction:** Surface and classify storage errors; wire IDB's `onError` to the same modal path OPFS uses.

### [High] "Unable to save" modal promises auto-retry that never happens
- **Evidence:** `StorageContext.tsx:177-179` copy vs the poll (`:143-148`) that only merges/reads and never replays the failed write. Misleading for quota.
- **Suggested direction:** Either implement a real write replay or correct the copy.

### [Medium] `runMerge` swallows every error, hiding a stuck adapter
- **Evidence:** `StorageContext.tsx:113-129` catch-all treats permanent failure as transient, looping silently while `frozen`.

### [Medium] `guardedWrite` is not atomic (op vs saveId bump)
- **Evidence:** `opfsAdapter.ts:196-202`, `idbAdapter.ts:71-77` — data can commit while `writeSaveId` fails, drifting data from its change marker.

### [Medium] Import mid-flight can hit ConflictError and partially apply
- **Evidence:** every import write passes `guardedWrite`→`hasConflict` (`opfsAdapter.ts:197`, `idbAdapter.ts:72`); the `importData` loop has no conflict handling; in replace mode the wipe already happened.

### [Low] Export/import blob codecs can OOM/throw with no handling
- **Evidence:** `exportImport.ts:4-16,18-37` — full in-memory base64 + pretty-printed JSON, `atob` throws on bad input, no guards.

### [Low] `URL.revokeObjectURL` fires synchronously after `a.click()`
- **Evidence:** `exportImport.ts:31-36` — can cancel the download in some browsers.

### Looks OK — Error handling
- "Already gone" deletes are safe no-ops; the conflict-freeze design is coherent and tested; `mergeInFlightRef` prevents overlapping polls; `UndoContext` clears before running undo and cleans timers; `revertTodoFields` handles deleted entries; OPFS blob getters degrade gracefully.

---

## Architecture & maintainability

### [High] `App.tsx` is a god component
- **Evidence:** 367 lines mixing string-match routing, resize drag, welcome seeding, undo wiring, and responsive state.
- **Suggested direction:** Extract routing, the resize controller, and welcome-seeding into focused modules/hooks.

### [Medium] Duplicated `EditTagsModal`, `capitalize`, and `extractText`
- **Evidence:** `EditTagsModal` duplicated across TimelineList + TimelineView; `capitalize` and `extractText` also duplicated.
- **Suggested direction:** Hoist to shared modules.

### [Medium] Dead interface surface — `mergeConflictFiles` and `duplicatedEntryId`
- **Evidence:** never consumed at runtime (proven by grep).
- *Cross-ref:* Dead code / Data integrity.

### Looks OK — Architecture
- Adapter abstraction, phase state machine, DB layer separation, and undo isolation are all sound.

---

## Docs accuracy

*(excludes `docs/blog/**` historical posts)*

### [High] README describes a storage architecture that no longer exists
- **Evidence:** `README.md:7` ("a folder you pick"), `:23` ("File System Access API"), `:80-81` (lists `fileAdapter.ts`, `handleStore.ts`), `:99-102,155` (fileAdapter architecture). Actual: `src/storage/` has `idbAdapter.ts` + **`opfsAdapter.ts`** — no fileAdapter/handleStore. `StorageContext.tsx:81-88` boots **OPFS-first, IDB fallback**; `:93-98` documents removal of all folder-picking. README also calls IndexedDB the "default" (`:79,99`), inverting the code.
- **Suggested direction:** Rewrite the storage-stack row, project structure, and architecture notes to `opfsAdapter`/`idbAdapter`, OPFS-primary.

### [High] User docs promise "Clear all data wipes it" — code doesn't
- **Evidence:** `docs/guide/storage-and-backup.md` ("Clear all data wipes it") vs `Settings.tsx:39-42,165`. Docs match intent, not behavior.
- **Suggested direction:** Treat as a code defect; keep the doc as intended behavior.
- *Cross-ref:* the **Critical** Usability finding.

### [Low] README "Node.js 20+" vs `engines >=22`
- **Evidence:** `README.md:31` vs `package.json` engines; AGENTS verifies 22/24/26.
- **Suggested direction:** Change README to "Node.js 22+".

### Looks OK — Docs
- Todos/due-date badge docs match `dateFormat.ts:60-76` exactly; 10s undo matches `UNDO_WINDOW_MS`. Storage-and-backup's OPFS/IDB description is accurate. Attachments, welcome flow (`App.tsx:154,357`), "No backup · Export now" nudge (`App.tsx:200-205`), timelines/tags/search guides, tutorials, and AGENTS.md (`check.sh`, deploy scripts, doc-check skill, localStorage trap) all match the code. README build-order claim matches `package.json`.

---

## Build, deploy & config

### [Medium] `.vercelignore` far narrower than `.gitignore` — local secrets/scratch upload to build context
- **Evidence:** `.vercelignore` excludes only `.ffmpeg/ .demo-* node_modules/ dist/`. It does **not** exclude `.env.local` (holds the OIDC token), `.pipeline.log` (310 KB), `.git/`, or the `.backlog/.llm/.hermes/.claude/.atomic` scratch. Vercel uses this file, not `.gitignore`, to decide uploads.
- **Why it matters:** `.env.local` and logs get packed into every `vercel deploy` upload (not served, but a credential file shipped to a remote build context; also bloat).
- **Suggested direction:** Mirror `.env*`, `*.log`, `.git/`, and local tool dirs into `.vercelignore`.

### [Low] Production deploy skips lint and the full check suite
- **Evidence:** `scripts/deploy.sh` runs only `tsc --noEmit` + `npm test` before `--prod`; the preview script runs full `scripts/check.sh` (`deploy-preview.sh:17-18`).
- **Suggested direction:** Have `deploy.sh` call `scripts/check.sh` so prod is never a weaker gate than preview.

### [Low] Node matrix documented but `engines` broad while `mise` pins 26
- **Evidence:** `package.json:6-8` `>=22`; `mise.toml` pins 26 with the `localStorage` shim documented in `AGENTS.md`/`src/test-setup.ts`. Deliberate and handled; the only risk is an untested future major auto-selected by `>=22`.
- **Suggested direction:** Optionally cap to `>=22 <27`.

### Looks OK — Build/Deploy/Config
- `.env.local`, `dist`, `.pipeline.log` all confirmed **not tracked**. `.vercelignore` correctly drops the ~600 MB ffmpeg/demo dirs. Vite `base:'/app/'` + `outDir:'dist/app'` split is coherent with `vercel.json outputDirectory:dist`. PWA manifest complete; `sw.js` `no-cache` pairs correctly with `autoUpdate`. `check.sh` is `set -euo pipefail`, fails fast, covers lint/tests/tsc/docs/app build.

---

## Privacy / data governance

### [High] `@vercel/analytics` contradicts the "data never leaves your device" promise, undisclosed
- **Evidence:** mounted unconditionally at `src/main.tsx:4,31` with no consent gate. Contradicts `README.md:6`, `docs/guide/storage-and-backup.md:3-4` ("Your data never leaves your device"), `docs/index.md:61-62`, and `docs/blog/posts/why-organizer-is-local-first.md:115` ("no third party sitting between you and [your data]"). A docs grep for analytics/telemetry/cookie finds **no disclosure** anywhere.
- **Why it matters:** The component sends page path/referrer/coarse device+geo to a third party. Journal content stays local, but "no server, no third party" is now literally false and invisible to users — a trust/truth-in-advertising problem.
- **Trade-offs / options:** remove entirely (restores the promise) vs opt-in default-off + disclose vs soften the docs copy.
- **Suggested direction:** Given how load-bearing the claim is, remove `<Analytics />` (or make it strictly opt-in) rather than dilute the promise; disclose if any stays.

### Looks OK — Privacy
- Journal data is genuinely local (export is a client-side Blob download at `exportImport.ts:30-36`; no network write path). No other beacons/trackers in `src/`.

---

## Suggested sequencing

### Wave 1 — Quick wins (low effort, disproportionate value)
- **Remove or disable the deceptive "Clear all data" button** if a real `clearAll()` can't land immediately (Usability, Critical) — stop lying to users today.
- **Remove `<Analytics />`** or gate it opt-in (Privacy, High) — one-line change that restores the headline promise.
- **Make the `EntryCard` catch-branch render text, not HTML** (Security, High) — closes the stored-XSS sink with a tiny edit.
- **Add `onClick` to search results** (Usability/A11y, High) — restores keyboard access.
- **Ship `nosniff` / `Referrer-Policy` / `frame-ancestors` headers** in `vercel.json` (Security).
- **Tighten `.vercelignore`** (`.env*`, `*.log`, `.git/`, scratch dirs) (Build/Config).
- Doc/hygiene fixes: README storage rewrite, README/docs Node version, test comment drift, memoize `EntryCard` HTML, prune `AppBanner`/`showNudge`/`zod` if not adopting them.

### Wave 2 — Correctness & security must-fixes
- **Implement a real `clearAll()`** across both adapters and wire it to Settings (Usability/Docs/Testing all converge here); add the emptiness-asserting test.
- **Validate imported JSON with zod before any write**, and **stage validation before the destructive `replace` delete** so a bad file can't half-wipe storage (Security / Data integrity / Type safety).
- **Defensive parse + quarantine for corrupt OPFS files** so one bad file can't wedge the app (Data integrity, High).
- **Surface and classify IDB write/quota failures**, and **fix the misleading "auto-retry" modal copy** (Error handling, two High items).
- **Add a full CSP** (report-only → enforce) as the XSS backstop (Security).
- **Add the Modal focus trap / restore** once in the shared component (Accessibility, High).
- **Test the highest-blast-radius surfaces**: StorageContext boot/merge/error paths, Settings, TimelineView, DueDatePopover; de-flake `SearchBox.test.tsx:70` (Testing).
- Make `deploy.sh` run the full `check.sh` gate.

### Wave 3 — Larger refactors
- **Enable TypeScript `strict`** and work through the null-check fallout (Type safety) — this hardens the whole tree and validates the import work above.
- **Virtualize the timeline and todo lists**, memoize context values, and lazy-load attachment object URLs (Performance).
- **Break up the `App.tsx` god component**; de-duplicate `EditTagsModal`/`capitalize`/`extractText`; prune the dead `mergeConflictFiles`/`duplicatedEntryId`/`mergeForeignState` interface surface (Architecture / Dead code).
- **Decide Playwright's fate**: add a minimal e2e smoke suite (OPFS, SW, export, contentEditable) into `check.sh`, or drop the unused dep; add a scoped coverage gate for `storage/` and `context/` (Testing).
- Address the remaining Medium data-integrity items (real import counts, `version` handling, blob-overwrite semantics, timestamp normalization).
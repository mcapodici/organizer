Fragment written to `reviews/_fragments/E-testing-docs.md`. Complete findings below.

# Fragment E — Testing & Quality + Docs Accuracy

Read-only review. Two angles.

---

## Angle 1 — TESTING & QUALITY

### Test inventory (21 test files)
- **Components WITH tests (5):** EntryCard, SearchBox, TagFilter, TagInput, TodoPage.
- **Components WITHOUT tests (9):** AppBanner, DueDatePopover, EntryComposer (only its `linkExtension.ts` helper is tested, not the 399-line editor), Modal, Settings, TimelineList, TimelineView, Toast, UndoBar.
- **Hooks:** all four tested. **Context:** UndoContext tested; **StorageContext has no test.**
- **Utils WITHOUT tests:** `welcome.ts`. **Storage/db:** well covered.

### [Severity: High] The brief's premise is partly stale — SearchBox *is* tested; the real gaps are Settings, TimelineView, TimelineList, EntryComposer, DueDatePopover
- Evidence: `src/components/SearchBox/SearchBox.test.tsx:39` has 4 real cases. Zero-test files: `Settings.tsx` (173 lines), `TimelineView.tsx` (225), `TimelineList.tsx` (216), `EntryComposer.tsx` (399), `DueDatePopover.tsx` (155).
- Why it matters: TimelineView/EntryComposer/Settings are core surfaces (create/edit/delete, attachments, destructive actions). Regressions land silently.
- Trade-offs / options: prioritise by blast radius (Settings/TimelineView/DueDatePopover first) vs by complexity (EntryComposer first, but TipTap is brittle in jsdom) vs thin smoke tests everywhere (fast but shallow).
- Suggested direction: Behavior tests for Settings, DueDatePopover, TimelineView first via the existing `FakeAdapter`; defer deep EntryComposer coverage.

### [Severity: High] "Clear all data" deletes nothing — a bug an absent Settings test would have caught
- Evidence: `src/components/Settings/Settings.tsx:39` — `handleReset` only `setResetModalOpen(false)` + `navigate('/')`; never calls any delete. The "Clear everything" button (`:165`) is wired to it. `grep` in `Settings/` for delete/clear calls returns only label strings. `StorageContext.tsx:97-98` even claims users clear data here — but the path is inert.
- Why it matters: The modal promises "delete **all** … permanently" (`Settings.tsx:157`). Data survives — a privacy/expectation failure on shared devices.
- Trade-offs / options: add a Settings test asserting stores are empty after "Clear everything" (fails today, pins the bug) vs App-level integration test (heavier).
- Suggested direction: Flag the bug to the owning fragment; add the emptiness-asserting test when fixed.

### [Severity: Medium] StorageContext (safety-critical seam) has no test, and every consumer mocks it away
- Evidence: no `StorageContext.test.tsx`; `App.test.tsx:13`, `SearchBox.test.tsx:9`, `useEntries.test.tsx:7`, `TodoPage.test.tsx:10` all `vi.mock` it. Untested: OPFS/IDB boot selection (`StorageContext.tsx:83-88`), 2s auto-merge poll (`108-148`), `withErrorCapture` (`24-55`), write-error modal (`167-217`).
- Why it matters: This code decides where data lives and silently merges concurrent edits — regressions here risk data loss invisibly.
- Trade-offs / options: provider test with fake timers + stub adapter vs extract `runMerge`/`withErrorCapture` as pure modules.
- Suggested direction: Focused provider test with `vi.useFakeTimers()` asserting a conflicting adapter triggers merge + toast on a poll tick.

### [Severity: Medium] Brittle wait in SearchBox test — real `setTimeout(50)` then negative assertion
- Evidence: `src/components/SearchBox/SearchBox.test.tsx:70` `await new Promise((r) => setTimeout(r, 50))` before `queryByText(...).toBeNull()`.
- Why it matters: Fixed wall-clock delay before a negative assertion is racy on slow CI and silently breaks if the debounce grows. Every other timing test uses fake timers (`UndoContext.test.tsx:8,36`).
- Trade-offs / options: switch to fake timers vs assert a positive "no matches" marker via `findBy`.
- Suggested direction: Prefer a positive "no results" signal via `findBy`; else drive with fake timers.

### [Severity: Medium] Playwright is a devDependency but there is no e2e coverage
- Evidence: `package.json:52,70`; `grep` finds `playwright` only in `scripts/record-demo.mjs:16` and `seed-and-shoot.mjs:10` (docs screenshots). No `*.spec.ts`, no `playwright.config.*`. `check.sh` runs only vitest.
- Why it matters: OPFS, PWA service worker, export download, real contentEditable can't run in jsdom; `@playwright/test` sits unused, implying unrealized intent.
- Trade-offs / options: add a minimal Playwright smoke flow into `check.sh` vs drop the unused `@playwright/test` dep.
- Suggested direction: Commit to a tiny smoke suite or remove the unused dep — don't leave it ambiguous.

### [Severity: Low] No coverage gate despite `@vitest/coverage-v8` installed
- Evidence: `package.json:61`; no `coverage` script; `vite.config.ts:131-139` sets no thresholds.
- Suggested direction: Add a `coverage` script + modest thresholds scoped to `storage/` and `context/`.

### [Severity: Low] Comment drift in the trap guard test
- Evidence: `test-setup.test.ts:4` says "Node 24+", but `test-setup.ts:9` and AGENTS.md say 24 is unaffected, only 26+.
- Suggested direction: Change the comment to "Node 26+".

### Looks OK (testing)
- The localStorage/jsdom trap is handled well (`test-setup.ts:51-71` probes the inert getter; `test-setup.test.ts` guards spec behavior). `FakeAdapter` implements the full interface — proportionate, not over-mocking. UndoContext uses fake timers correctly. Storage/merge is the best-covered area. `check.sh --no-file-parallelism` + `pool: 'threads'` is deliberate and documented.

---

## Angle 2 — DOCS ACCURACY (excludes docs/blog/**)

### [Severity: High] README describes a storage architecture that no longer exists
- Evidence: `README.md:7` ("a folder you pick"), `:23` ("File System Access API"), `:80-81` (lists `fileAdapter.ts`, `handleStore.ts`), `:99-102,155` (fileAdapter architecture). Actual: `src/storage/` has `idbAdapter.ts` + **`opfsAdapter.ts`** — no fileAdapter/handleStore. `StorageContext.tsx:81-88` boots **OPFS-first, IDB fallback**; `:93-98` documents removal of all folder-picking. README also calls IndexedDB the "default" (`:79,99`), inverting the code.
- Suggested direction: Rewrite the storage stack row, project structure, and architecture notes to `opfsAdapter`/`idbAdapter`, OPFS-primary.

### [Severity: High] User docs promise "Clear all data wipes it" — code doesn't
- Evidence: `docs/guide/storage-and-backup.md` ("Clear all data wipes it") vs `Settings.tsx:39-42,165`. Docs match intent, not behavior.
- Suggested direction: Treat as a code defect; keep the doc as intended behavior.

### [Severity: Low] README "Node.js 20+" vs `engines >=22`
- Evidence: `README.md:31` vs `package.json` engines; AGENTS verifies 22/24/26.
- Suggested direction: Change README to "Node.js 22+".

### Looks OK (docs)
- Todos/due-date badge docs match `dateFormat.ts:60-76` exactly; 10s undo matches `UNDO_WINDOW_MS`. Storage-and-backup's OPFS/IDB description is accurate. Attachments, welcome flow (`App.tsx:154,357`), "No backup · Export now" nudge (`App.tsx:200-205`), timelines/tags/search guides, tutorials, and AGENTS.md (`check.sh`, deploy scripts, doc-check skill, localStorage trap) all match the code. README build-order claim matches `package.json`.

---

## Top 3 priorities for this fragment
1. **Fix + test "Clear all data"** (`Settings.tsx:39`) — deletes nothing while modal/docs promise a permanent wipe; highest data-trust risk.
2. **Correct README's storage architecture** (`README.md:7,23,80-102`) — drop fileAdapter/handleStore/File System Access API; describe OPFS-first + IDB fallback.
3. **Close highest-value test gaps** — StorageContext boot/merge/error paths and core UI (TimelineView, DueDatePopover, Settings); de-flake `SearchBox.test.tsx:70`.
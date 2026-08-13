# TODO — Review follow-ups

Selected from the multi-angle review. Full detail (evidence, trade-offs,
suggested direction) lives in [`reviews/REVIEW.md`](reviews/REVIEW.md); the
per-angle research is in [`reviews/_fragments/`](reviews/_fragments/). Those
files are the reference — this list is only the work chosen to act on.

Severity tags: **Critical** > **High** > **Medium** > **Low**.

## Security

- [x] **[High] Validate imported JSON before any write** — add runtime schema
      validation (zod is installed but unused) and stage validation *before* the
      destructive `replace` wipe. `src/utils/exportImport.ts:40`
- [x] **[High] EntryCard fallback: render text, not HTML** — the `catch` branch
      injects raw `entry.content` via `dangerouslySetInnerHTML` (stored-XSS
      sink). `src/components/EntryCard/EntryCard.tsx:34-46`
- [x] **[High] Add CSP + security headers on Vercel** — no CSP / `nosniff` /
      `Referrer-Policy` / `frame-ancestors`. `vercel.json`
- [x] **[Medium] Fix dependency vulnerabilities** — `npm audit fix`, bump
      `vite` / `react-router-dom`, re-run `scripts/check.sh`.

## Data integrity & persistence

- [x] **[High] Quarantine corrupt OPFS files** — defensive parse at scan time;
      one invalid file currently wedges the app in a 2s retry loop.
      `src/storage/opfsAdapter.ts:161`
- [x] **[Medium] Guard import against missing `timelines`/`entries` arrays** —
      unguarded iteration crashes the importer. `src/utils/exportImport.ts:61-66`
- [x] **[Medium] Import: honor `version`; fix blob overwrite in merge mode** —
      `version` ignored; blobs overwrite even when entries are skipped.
      `src/utils/exportImport.ts:41,67`

## Usability / UX

- [x] **[Critical] Implement a real "Clear all data"** — `handleReset` deletes
      nothing and no `clearAll()` exists; data survives a wipe the UI promises.
      Disable the button if the real fix can't land immediately.
      `src/components/Settings/Settings.tsx:39-42`

## Error handling & resilience

- [ ] **[High] Surface IDB write/quota failures** — IDB has a no-op `onError`;
      `QuotaExceededError` bubbles to an uncaught handler with no UI.
      `src/context/StorageContext.tsx:136`
- [ ] **[High] Fix the misleading "auto-retry" save modal** — copy promises a
      retry the poll never performs; implement replay or correct the copy.
      `src/context/StorageContext.tsx:177`
- [ ] **[Medium] Make `guardedWrite` atomic** — data can commit while the
      `saveId` bump fails, drifting data from its change marker.
      `src/storage/opfsAdapter.ts:196`, `src/storage/idbAdapter.ts:71`
- [ ] **[Medium] Handle import `ConflictError` / partial apply** — the
      `importData` loop has no conflict handling; in replace mode the wipe
      already ran. `src/utils/exportImport.ts`
- [ ] **[Low] Guard export/import blob codecs** — full in-memory base64; `atob`
      throws on bad input, no guards. `src/utils/exportImport.ts:4-37`
- [ ] **[Low] Defer `URL.revokeObjectURL` after download** — revokes
      synchronously after `a.click()`, can cancel the download.
      `src/utils/exportImport.ts:31-36`

## Accessibility

- [ ] **[High] Modal: focus trap, focus-on-open, focus restore** — `aria-modal`
      claims the background is inert but focus stays behind it and Tab escapes.
      Fix once in the shared component. `src/components/Modal.tsx:10-37`
- [ ] **[High] Make search results keyboard-selectable** — bound to
      `onMouseDown` only; Tab+Enter fires `click` and does nothing. Add
      `onClick`. `src/components/SearchBox/SearchBox.tsx:144`
- [ ] **[Medium] Fix todo card nested-interactive `role="button"`** — a
      `role=button` div wraps a real `<button>`; key handler misses Space.
      `src/components/TodoPage/TodoPage.tsx:224`
- [ ] **[Medium] Overdue badge not distinguished by color alone** — add an
      `aria-label` (e.g. "3 todos, 2 overdue") + a non-color glyph (WCAG 1.4.1).
      `src/components/TimelineList/TimelineList.tsx:116`
- [ ] **[Low] Composer date/time inputs: add aria-labels** — inputs lack a
      programmatic name; due-date block has one ambiguous label.
      `src/components/EntryComposer/EntryComposer.tsx:261-315`
- [ ] **[Low] Attachment thumbnail: real button + real alt** — clickable `<img>`
      has no keyboard access; lightbox alt is "Full size" though
      `attachment.name` is available. `src/components/EntryCard/EntryCard.tsx:214`

## Usability / UX (continued)

- [ ] **[Medium] Timeline title edit: keyboard access** — rename triggered by
      clicking a bare `<h1>` (no tabIndex/key handler). Add an explicit edit
      button. `src/components/TimelineView/TimelineView.tsx:135`
- [ ] **[Medium] Image lightbox: closable by keyboard** — overlay closes on
      click only (no Escape/dialog role). Route through the shared `Modal`.
      `src/components/EntryCard/EntryCard.tsx:144`
- [ ] **[Low] Standardize UI glyphs to lucide icons** — ✕/×/✎/+ text glyphs used
      as chrome (UI_STANDARDS #5). Use lucide `X`.
- [ ] **[Low] Toast: use design tokens** — hard-codes hex instead of the
      `index.css` tokens (UI_STANDARDS #1). `src/components/Toast/Toast.tsx:36-52`

## Type safety

- [ ] **[High] Enable TypeScript strict mode** — no `strict`/`strictNullChecks`
      anywhere, so every `!` (`this.root!`, `dueDate!`) is unverified. Enable
      `strict`, then work through the fallout. `tsconfig*.json`

## Data integrity & persistence (continued)

- [ ] **[Low] Normalize timestamp ordering** — `useEntries`/`useTimelines`/
      `merge` string-compare ISO timestamps; breaks on mixed offsets/precision
      from imported data. `src/hooks/useEntries.ts:15`, `src/storage/merge.ts:19`

## Testing & quality

- [ ] **[High] Behavior tests for untested core surfaces** — Settings,
      DueDatePopover, TimelineView (create/edit/delete, attachments, destructive
      actions) have zero tests. Use the existing `FakeAdapter`.
- [ ] **[Medium] Add a StorageContext provider test** — safety-critical seam
      (boot selection, 2s merge poll, write-error modal) is untested and every
      consumer mocks it away. `src/context/StorageContext.tsx`
- [ ] **[Medium] Fix the brittle SearchBox timer test** — real `setTimeout(50)`
      before a negative assertion is racy on CI; use fake timers / a positive
      signal. `src/components/SearchBox/SearchBox.test.tsx:70`

## Dead code

- [ ] **[Medium] Remove unused `AppBanner` component + CSS** — only
      self-references (proven by grep).
- [ ] **[Medium] Prune dead interface surface** — `mergeConflictFiles` (zero
      stubs), `duplicatedEntryId`, and `mergeForeignState` are never consumed at
      runtime. Prune, or wire to a real consumer if planned.
      `src/storage/interface.ts`, `src/storage/merge.ts:34`
- [ ] **[Low] Remove/re-enable the `showNudge` branch** — hard-coded `false`
      makes the export-nudge branch unreachable.

## Architecture & maintainability

- [ ] **[High] Break up the `App.tsx` god component** — 367 lines mixing
      routing, resize drag, welcome seeding, undo wiring, and responsive state.
      Extract into focused modules/hooks. `src/App.tsx`
- [ ] **[Medium] De-duplicate `EditTagsModal` / `capitalize` / `extractText`** —
      duplicated across TimelineList + TimelineView. Hoist to shared modules.

## Docs accuracy

- [ ] **[High] Rewrite the README storage architecture** — README still
      describes `fileAdapter`/`handleStore`/File System Access API that no longer
      exist; actual is OPFS-primary + IDB fallback. `README.md:7,23,80,99`
- [ ] **[Low] README: "Node.js 20+" → "22+"** — `engines` is `>=22`; AGENTS
      verifies 22/24/26. `README.md:31`

## Build, deploy & config

- [ ] **[Medium] Tighten `.vercelignore`** — doesn't exclude `.env.local` (OIDC
      token), `.pipeline.log` (310 KB), `.git/`, or scratch dirs; all upload to
      the build context. Mirror `.env*`, `*.log`, `.git/`, local tool dirs.
- [ ] **[Low] `deploy.sh`: run the full `check.sh` gate** — prod runs only
      `tsc` + test while preview runs full `check.sh`. Make prod no weaker.
- [ ] **[Low] Cap `engines` to `>=22 <27`** — open `>=22` could auto-select an
      untested future major on Vercel; `mise` pins 26. `package.json`
- [ ] **[Low/Medium] Fix import-count toasts** — OPFS `importedCount` is
      structurally always 0; IDB merge count is a constant `1`/`0`, so the toast
      number is wrong/meaningless across backends.
      `src/storage/opfsAdapter.ts:188`, `src/storage/idbAdapter.ts:59`
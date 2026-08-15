Wrote `audit/INDEX.md`. Here is the complete assembled index, verbatim.

# Organizer — UI/UX Audit Index

**Date:** 2026-08-15 · **Type:** Read-only, browser-driven audit · **Source code changed:** none

This is the master index for a live, browser-driving UX/UI audit of the Organizer app. Eight areas were driven against the seeded fixture (5 timelines / 17 entries, IndexedDB forced, welcome skipped) in isolated Playwright sessions: **timelines, entries-composer, todos-duedates, search, tags, settings, undo, and mobile**. Every finding was reproduced live; fixes were demonstrated only via throwaway in-page tweaks discarded on reload. No application source was modified — the only writes are documentation and media under `audit/`. Each finding folder holds `finding.md`, `issue.webm`, an annotated `issue-*.png`, and an improved artifact (`improved.webm` and/or `improved-mockup.png`). This index is the entry point for the **separate fix run**; every row links to the folder with the exact repro and fix pointer.

**Totals:** 40 findings across 8 areas — 1 Critical, 12 High, 22 Medium, 5 Low.

## Priority table (worst first)

| # | Area | Finding | Type | Severity | Effort | Folder |
|---|------|---------|------|----------|--------|--------|
| 1 | settings | "Clear all data" deletes nothing — destructive action is a no-op | Bug | Critical | M | [settings/01-clear-data-noop/](settings/01-clear-data-noop/finding.md) |
| 2 | search | Focused result can't be activated with Enter/Space (mouse-only `onMouseDown`) | Bug | High | S | [search/02-results-mouse-only-activation/](search/02-results-mouse-only-activation/finding.md) |
| 3 | timelines | App logo broken everywhere (404 on `/logo.svg`, ignores `/app/` base) | Bug | High | S | [timelines/01-broken-logo-404/](timelines/01-broken-logo-404/finding.md) |
| 4 | mobile | Entry Copy/Edit/Delete clip off-screen on to-do entries (Delete unreachable) | Bug | High | S | [mobile/01-entry-actions-clipped/](mobile/01-entry-actions-clipped/finding.md) |
| 5 | settings | Importing malformed JSON fails silently — no error shown | Bug | High | S | [settings/02-silent-import-failure/](settings/02-silent-import-failure/finding.md) |
| 6 | search | Search results cannot be navigated or activated with the keyboard | Bug | High | M | [search/01-no-keyboard-navigation/](search/01-no-keyboard-navigation/finding.md) |
| 7 | todos-duedates | Card body is one giant `role="button"` nesting the due-date button | Bug | High | M | [todos-duedates/01-nested-interactive-cardbody/](todos-duedates/01-nested-interactive-cardbody/finding.md) |
| 8 | settings | Modals don't manage focus — no trap, keyboard escapes to background | Bug | High | M | [settings/04-modal-focus-trap/](settings/04-modal-focus-trap/finding.md) |
| 9 | undo | Undo bar not keyboard reachable — focus never moved, expires before Tab | Bug | High | M | [undo/01-focus-not-moved-to-undo/](undo/01-focus-not-moved-to-undo/finding.md) |
| 10 | entries-composer | No toolbar control to add/edit/remove a link | UX | High | M | [entries-composer/01-no-link-toolbar-button/](entries-composer/01-no-link-toolbar-button/finding.md) |
| 11 | todos-duedates | Due-date popover not keyboard-reachable — no focus, no trap, no return | UX | High | M | [todos-duedates/02-popover-keyboard-focus/](todos-duedates/02-popover-keyboard-focus/finding.md) |
| 12 | undo | Deleting an entry offers no undo, only a "cannot be undone" modal | UX | High | M | [undo/03-no-undo-for-entry-delete/](undo/03-no-undo-for-entry-delete/finding.md) |
| 13 | undo | Deleting a timeline destroys it + all entries with no undo | UX | High | L | [undo/04-no-undo-for-timeline-delete/](undo/04-no-undo-for-timeline-delete/finding.md) |
| 14 | entries-composer | "Insert table" nests a table inside a table | Bug | Medium | S | [entries-composer/02-insert-table-nests-tables/](entries-composer/02-insert-table-nests-tables/finding.md) |
| 15 | tags | Filter tag toggles missing `aria-pressed` (state by colour alone) | Bug | Medium | S | [tags/04-filter-tags-missing-aria-pressed/](tags/04-filter-tags-missing-aria-pressed/finding.md) |
| 16 | tags | Case-insensitive duplicate tags silently split a tag in two | Bug | Medium | S | [tags/01-case-insensitive-duplicate-tags/](tags/01-case-insensitive-duplicate-tags/finding.md) |
| 17 | undo | Mobile undo bar goes full-width and is covered by the merge toast | Bug | Medium | S | [undo/05-mobile-undo-toast-overlap/](undo/05-mobile-undo-toast-overlap/finding.md) |
| 18 | settings | App logo 404s — hard-coded `/logo.svg` ignores `/app/` base path | Bug | Medium | S | [settings/05-logo-404-basepath/](settings/05-logo-404-basepath/finding.md) |
| 19 | mobile | Header/app logo is a broken image (`/logo.svg` ignores `/app/` base) | Bug | Medium | S | [mobile/03-broken-logo-image/](mobile/03-broken-logo-image/finding.md) |
| 20 | entries-composer | Composer loses focus after Save (and on Edit) | UX | Medium | S | [entries-composer/03-composer-focus-lost/](entries-composer/03-composer-focus-lost/finding.md) |
| 21 | entries-composer | Per-entry Copy/Edit/Delete unreachable by keyboard | UX | Medium | S | [entries-composer/04-entry-actions-not-keyboard-reachable/](entries-composer/04-entry-actions-not-keyboard-reachable/finding.md) |
| 22 | todos-duedates | Check button (22px) and due pill (~21px) below WCAG 24px tap target | UX | Medium | S | [todos-duedates/03-small-hit-targets/](todos-duedates/03-small-hit-targets/finding.md) |
| 23 | todos-duedates | Popover dismissed by any scroll (`window` capture scroll → close) | UX | Medium | S | [todos-duedates/04-popover-scroll-dismiss/](todos-duedates/04-popover-scroll-dismiss/finding.md) |
| 24 | todos-duedates | "Mark as done" is an empty ring — check glyph invisible until hover | UX | Medium | S | [todos-duedates/06-checkbutton-affordance/](todos-duedates/06-checkbutton-affordance/finding.md) |
| 25 | search | No "no results" state — an unmatched query shows nothing at all | UX | Medium | S | [search/03-no-empty-state/](search/03-no-empty-state/finding.md) |
| 26 | search | Matches in the timeline name aren't highlighted — results look unrelated | UX | Medium | S | [search/04-timeline-name-match-not-highlighted/](search/04-timeline-name-match-not-highlighted/finding.md) |
| 27 | tags | Filter chips + Clear vanish when panel collapsed while filter stays applied | UX | Medium | S | [tags/02-filter-hidden-when-panel-collapsed/](tags/02-filter-hidden-when-panel-collapsed/finding.md) |
| 28 | settings | Export gives no confirmation; its only feedback is dead on OPFS | UX | Medium | S | [settings/03-export-no-feedback/](settings/03-export-no-feedback/finding.md) |
| 29 | settings | "Replace all data" import is one-click destructive with no warning | UX | Medium | S | [settings/06-replace-import-no-warning/](settings/06-replace-import-no-warning/finding.md) |
| 30 | timelines | Timeline title is click-to-rename but keyboard-inaccessible, no affordance | UX | Medium | S | [timelines/02-title-rename-not-keyboard/](timelines/02-title-rename-not-keyboard/finding.md) |
| 31 | timelines | Sidebar reorders under you: active timeline jumps to top on every edit | UX | Medium | M | [timelines/04-sidebar-reorders-on-edit/](timelines/04-sidebar-reorders-on-edit/finding.md) |
| 32 | undo | A second undoable action silently discards the first (single slot) | UX | Medium | M | [undo/02-undo-superseded-loses-first/](undo/02-undo-superseded-loses-first/finding.md) |
| 33 | mobile | Composer/toolbar/entry controls below the 44px touch-target minimum | UX | Medium | M | [mobile/02-tiny-tap-targets/](mobile/02-tiny-tap-targets/finding.md) |
| 34 | todos-duedates | "DUE SOON" badge fails AA contrast (3.15:1); OVERDUE marginal (4.41:1) | Style | Medium | S | [todos-duedates/05-duesoon-badge-contrast/](todos-duedates/05-duesoon-badge-contrast/finding.md) |
| 35 | entries-composer | TipTap "Duplicate extension names" console spam | Bug | Low | S | [entries-composer/05-tiptap-duplicate-extension-warning/](entries-composer/05-tiptap-duplicate-extension-warning/finding.md) |
| 36 | search | Internal "Timeline Start" marker entries pollute results | UX | Low | S | [search/05-timeline-start-entries-in-results/](search/05-timeline-start-entries-in-results/finding.md) |
| 37 | tags | Filtering not reflected in header — open filtered-out timeline stays rendered | UX | Low | S | [tags/03-filter-not-reflected-in-header/](tags/03-filter-not-reflected-in-header/finding.md) |
| 38 | undo | Undo labels never name the affected item ("Marked done" — which one?) | UX | Low | S | [undo/06-ambiguous-undo-label/](undo/06-ambiguous-undo-label/finding.md) |
| 39 | timelines | Emoji/dingbat glyph (`✎`) used as UI icon on tag buttons | Style | Low | S | [timelines/03-emoji-edit-tags-icon/](timelines/03-emoji-edit-tags-icon/finding.md) |
| 40 | mobile | Fullscreen composer header overlapped by the fixed hamburger button | Style | Low | S | [mobile/04-fullscreen-editor-menu-overlap/](mobile/04-fullscreen-editor-menu-overlap/finding.md) |

---

## timelines

I drove a dedicated `tl-audit` Playwright session against the seeded app (forced onto the IndexedDB adapter), reproduced real flows, and filed 4 findings. Notable: the broken logo recurs across the app (see settings/mobile), and the sidebar re-sorting on every save stems from `updatedAt=now` in `useTimelines.ts` + `App.touchActiveTimeline`.

| # | Title | Type | Severity | Effort | Folder |
|---|-------|------|----------|--------|--------|
| 01 | App logo is broken everywhere (404 on `/logo.svg`) | Bug | High | S | [01-broken-logo-404/](timelines/01-broken-logo-404/finding.md) |
| 02 | Timeline title is click-to-rename but keyboard-inaccessible with no affordance | UX | Medium | S | [02-title-rename-not-keyboard/](timelines/02-title-rename-not-keyboard/finding.md) |
| 03 | Emoji/dingbat glyphs used as UI icons on the tag buttons | Style | Low | S | [03-emoji-edit-tags-icon/](timelines/03-emoji-edit-tags-icon/finding.md) |
| 04 | Sidebar reorders under you: active timeline jumps to top on every entry edit | UX | Medium | M | [04-sidebar-reorders-on-edit/](timelines/04-sidebar-reorders-on-edit/finding.md) |

Checked and healthy: delete confirm modal, `aria-label`led kebab, global `:focus-visible` + `prefers-reduced-motion`, blocked empty-name renames, non-clipping kebab dropdown.

## entries-composer

Documented 5 reproduced issues in the rich-text composer area, each with a spec, repro video, annotated screenshot, and improved artifact.

| # | Title | Type | Severity | Effort | Folder |
|---|-------|------|----------|--------|--------|
| 01 | No toolbar control to add/edit/remove a link | UX | High | M | [01-no-link-toolbar-button/](entries-composer/01-no-link-toolbar-button/finding.md) |
| 02 | "Insert table" nests a table inside a table | Bug | Medium | S | [02-insert-table-nests-tables/](entries-composer/02-insert-table-nests-tables/finding.md) |
| 03 | Composer loses focus after Save (and on Edit) | UX | Medium | S | [03-composer-focus-lost/](entries-composer/03-composer-focus-lost/finding.md) |
| 04 | Per-entry Copy/Edit/Delete unreachable by keyboard | UX | Medium | S | [04-entry-actions-not-keyboard-reachable/](entries-composer/04-entry-actions-not-keyboard-reachable/finding.md) |
| 05 | TipTap "Duplicate extension names" console spam | Bug | Low | S | [05-tiptap-duplicate-extension-warning/](entries-composer/05-tiptap-duplicate-extension-warning/finding.md) |

Healthy: paste sanitization (script stripped, `rel="noopener"` kept), trailing paragraph after tables, global `:focus-visible` on toolbar buttons, touch reveal via `@media (hover: none)`, expand overlay respecting header/sidebar.

## todos-duedates

Seeded `audit-todos` session with overdue/today/soon/later todos; drove real flows to find and reproduce 6 issues. Two High findings concern keyboard/interactive-nesting a11y.

| # | Title | Type | Severity | Effort | Folder |
|---|-------|------|----------|--------|--------|
| 01 | Card body is one giant `role="button"` nesting the due-date button | Bug | High | M | [01-nested-interactive-cardbody/](todos-duedates/01-nested-interactive-cardbody/finding.md) |
| 02 | Due-date popover not keyboard-reachable — no focus, no trap, no return | UX | High | M | [02-popover-keyboard-focus/](todos-duedates/02-popover-keyboard-focus/finding.md) |
| 03 | Check button (22×22) and due pill (~21px) below the WCAG 24px minimum | UX | Medium | S | [03-small-hit-targets/](todos-duedates/03-small-hit-targets/finding.md) |
| 04 | Popover is dismissed by *any* scroll (`window` capture scroll → close) | UX | Medium | S | [04-popover-scroll-dismiss/](todos-duedates/04-popover-scroll-dismiss/finding.md) |
| 05 | "DUE SOON" badge fails AA contrast (3.15:1); OVERDUE marginal (4.41:1) | Style | Medium | S | [05-duesoon-badge-contrast/](todos-duedates/05-duesoon-badge-contrast/finding.md) |
| 06 | "Mark as done" is an empty ring — check glyph invisible until hover | UX | Medium | S | [06-checkbutton-affordance/](todos-duedates/06-checkbutton-affordance/finding.md) |

Findings 05/06 also flag UI_STANDARDS violations (§1 tokens, §3 contrast, §4 hover-revealed actions).

## search

Drove the seeded app live in a `search-audit` session; reproduced every issue and demonstrated each fix with a throwaway tweak. Keyboard support is fully broken and the empty state is silent.

| # | Title | Type | Severity | Effort | Folder |
|---|-------|------|----------|--------|--------|
| 01 | Search results cannot be navigated or activated with the keyboard | Bug | High | M | [01-no-keyboard-navigation/](search/01-no-keyboard-navigation/finding.md) |
| 02 | A focused result can't be activated with Enter/Space (mouse-only `onMouseDown`) | Bug | High | S | [02-results-mouse-only-activation/](search/02-results-mouse-only-activation/finding.md) |
| 03 | No "no results" state — an unmatched query shows nothing at all | UX | Medium | S | [03-no-empty-state/](search/03-no-empty-state/finding.md) |
| 04 | Matches in the timeline name aren't highlighted — results look unrelated | UX | Medium | S | [04-timeline-name-match-not-highlighted/](search/04-timeline-name-match-not-highlighted/finding.md) |
| 05 | Internal "Timeline Start" marker entries pollute results | UX | Low | S | [05-timeline-start-entries-in-results/](search/05-timeline-start-entries-in-results/finding.md) |

Every `finding.md` points into `src/components/SearchBox/SearchBox.tsx` (and its module CSS).

## tags

Isolated `tagsaudit` session; documented 4 reproducible issues. Efforts are small targeted fixes into `TagInput.tsx`, `useTags.ts`, and `TagFilter`.

| # | Title | Type | Severity | Effort | Folder |
|---|-------|------|----------|--------|--------|
| 01 | Case-insensitive duplicate tags silently split a tag in two | Bug | Medium | S | [01-case-insensitive-duplicate-tags/](tags/01-case-insensitive-duplicate-tags/finding.md) |
| 02 | Filter chips + Clear vanish when panel collapsed while filter stays applied | UX | Medium | S | [02-filter-hidden-when-panel-collapsed/](tags/02-filter-hidden-when-panel-collapsed/finding.md) |
| 03 | Filtering not reflected in header — open filtered-out timeline stays rendered | UX | Low | S | [03-filter-not-reflected-in-header/](tags/03-filter-not-reflected-in-header/finding.md) |
| 04 | Filter tag toggles missing `aria-pressed` (state by colour alone) | Bug | Medium | S | [04-filter-tags-missing-aria-pressed/](tags/04-filter-tags-missing-aria-pressed/finding.md) |

## settings

Booted the app, seeded via `seedData` (IndexedDB + a second OPFS session), and drove real flows with a `settings-audit` session. Contains the audit's only **Critical**: the destructive "Clear all data" is a no-op.

| # | Title | Type | Severity | Effort | Folder |
|---|-------|------|----------|--------|--------|
| 01 | "Clear all data" deletes nothing — destructive action is a no-op | Bug | Critical | M | [01-clear-data-noop/](settings/01-clear-data-noop/finding.md) |
| 02 | Importing malformed JSON fails silently — no error shown | Bug | High | S | [02-silent-import-failure/](settings/02-silent-import-failure/finding.md) |
| 03 | Export gives no confirmation; its only feedback is dead on OPFS | UX | Medium | S | [03-export-no-feedback/](settings/03-export-no-feedback/finding.md) |
| 04 | Modals don't manage focus — no trap, keyboard escapes to background | Bug | High | M | [04-modal-focus-trap/](settings/04-modal-focus-trap/finding.md) |
| 05 | App logo 404s — hard-coded `/logo.svg` ignores `/app/` base path | Bug | Medium | S | [05-logo-404-basepath/](settings/05-logo-404-basepath/finding.md) |
| 06 | "Replace all data" import is one-click destructive with no warning | UX | Medium | S | [06-replace-import-no-warning/](settings/06-replace-import-no-warning/finding.md) |

Verified-good: export/import round-trip; global `:focus-visible` + `prefers-reduced-motion`; lucide `Globe` icon (not emoji) on the Backend row.

## undo

Read-only audit of `UndoContext`, `UndoBar`, `Toast`, and the delete/edit flows. Two dominant themes: undo only covers reversible todo field flips (destructive deletes get a modal and no undo), and the undo bar is not accessible.

| # | Title | Type | Severity | Effort | Folder |
|---|-------|------|----------|--------|--------|
| 01 | Undo bar not keyboard reachable — focus never moved, expires before Tab | Bug | High | M | [01-focus-not-moved-to-undo/](undo/01-focus-not-moved-to-undo/finding.md) |
| 02 | A second undoable action silently discards the first (single slot) | UX | Medium | M | [02-undo-superseded-loses-first/](undo/02-undo-superseded-loses-first/finding.md) |
| 03 | Deleting an entry offers no undo, only a "cannot be undone" modal | UX | High | M | [03-no-undo-for-entry-delete/](undo/03-no-undo-for-entry-delete/finding.md) |
| 04 | Deleting a timeline destroys it + all entries with no undo | UX | High | L | [04-no-undo-for-timeline-delete/](undo/04-no-undo-for-timeline-delete/finding.md) |
| 05 | On mobile the undo bar goes full-width and is covered by the merge toast | Bug | Medium | S | [05-mobile-undo-toast-overlap/](undo/05-mobile-undo-toast-overlap/finding.md) |
| 06 | Undo labels never name the affected item ("Marked done" — which one?) | UX | Low | S | [06-ambiguous-undo-label/](undo/06-ambiguous-undo-label/finding.md) |

## mobile

Drove the app at 390×844 (touch, mobile UA) via `mobaudit`, forcing IndexedDB + skip-welcome with `seedData`. Todos, search, settings, due-date popover, and kebab menu held up; 4 issues stood out.

| # | Title | Type | Severity | Effort | Folder |
|---|-------|------|----------|--------|--------|
| 01 | Entry Copy/Edit/Delete clip off-screen on to-do entries (Delete unreachable) | Bug | High | S | [01-entry-actions-clipped/](mobile/01-entry-actions-clipped/finding.md) |
| 02 | Composer/toolbar/entry controls below the 44px touch-target minimum | UX | Medium | M | [02-tiny-tap-targets/](mobile/02-tiny-tap-targets/finding.md) |
| 03 | Header/app logo is a broken image (`/logo.svg` ignores `/app/` base) | Bug | Medium | S | [03-broken-logo-image/](mobile/03-broken-logo-image/finding.md) |
| 04 | Fullscreen composer header overlapped by the fixed hamburger button | Style | Low | S | [04-fullscreen-editor-menu-overlap/](mobile/04-fullscreen-editor-menu-overlap/finding.md) |

---

## Suggested fix waves

### Wave 1 — Quick wins (small, high-leverage, mostly one-file)
- **Broken logo, once, everywhere.** The same `/logo.svg` vs `/app/` base bug is filed in three areas (#3 timelines, #18 settings, #19 mobile) plus `AppBanner.tsx`. Fix `import.meta.env.BASE_URL` in `App.tsx` (three sites) + `AppBanner.tsx`; update `App.test.tsx`. Closes all three in one change.
- **TipTap duplicate-extension spam** (#35) — drop the re-added Link/Underline in `EntryCard.tsx`/`EntryComposer.tsx` (StarterKit bundles them). Clears console noise seen across every area.
- **a11y parity + affordance quick fixes:** `aria-pressed` on filter toggles (#15), check-button visible affordance (#24), DUE SOON/OVERDUE contrast (#34), emoji→lucide icon (#39), fullscreen burger overlap (#40), ambiguous undo labels (#38), timeline-start results filter (#36), search empty state (#25), timeline-name match highlight (#26).

### Wave 2 — Correctness / bugs (data-integrity and broken interactions)
- **Critical first:** "Clear all data" no-op (#1) — wire `handleReset()` to the storage adapter. This is a privacy/safety hazard.
- **Silent failures & destructive gaps:** silent import failure (#5), replace-all-import warning (#29), export feedback (#28).
- **Broken interactions:** search keyboard nav + activation (#2, #6), nested interactive card body (#7), insert-table nesting (#14), case-insensitive duplicate tags (#16), popover scroll-dismiss (#23), collapsed-filter-still-applied (#27), sidebar reorder on edit (#31).
- **Mobile layout bugs:** entry actions clipped/Delete unreachable (#4), undo/toast overlap (#17).

### Wave 3 — Larger UX (a11y systems, undo model, touch targets)
- **Focus management as a shared concern:** modal focus trap (#8), undo bar focus (#9), due-date popover focus/trap/return (#11), composer focus after save (#20), keyboard-reachable entry actions (#21), keyboard-accessible title rename (#30). Consider one reusable focus-trap/roving-focus primitive.
- **Undo model overhaul:** undo for entry delete (#12) and timeline delete (#13), and a multi-slot undo stack so a second action doesn't discard the first (#32).
- **Composer & touch ergonomics:** link toolbar UI + popover (#10), 44px touch targets across composer/toolbar/todos (#22, #33), tag-filter reflected in header (#37).
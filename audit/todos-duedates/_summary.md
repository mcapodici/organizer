Audit complete. The read-only audit of the **todos-duedates** area is done — no source files were touched; all writes are documentation and media under `audit/todos-duedates/`.

## Summary

I seeded the app (forced IndexedDB, skipped the welcome timeline, loaded the standard fixture: 5 timelines / 17 entries with overdue/today/soon/later todos) in a dedicated `audit-todos` Playwright session, then drove real flows to find and reproduce **6 genuine issues**. Each folder has `finding.md`, `issue.webm`, annotated `issue-*.png`, and an `improved.webm` + `improved-mockup.png` from a throwaway in-page tweak (reverted by reload).

| # | Title | Type | Severity | Effort |
|---|---|---|---|---|
| 01 | Card body is one giant `role="button"` that nests the due-date button — bloated screen-reader label + invalid interactive nesting | Bug | **High** | M |
| 02 | Due-date popover not keyboard-reachable — focus never enters the dialog, no trap, no return; Tab escapes to cards behind it | UX | **High** | M |
| 03 | Check button (22×22) and due pill (~21px tall) below the WCAG 24px minimum tap target | UX | Medium | S |
| 04 | Popover is dismissed by *any* scroll (`window` capture scroll → `onClose`) | UX | Medium | S |
| 05 | "DUE SOON" badge fails AA contrast (`#16a34a` on `#f0fdf4` = 3.15:1); OVERDUE marginal at 4.41:1 | Style | Medium | S |
| 06 | "Mark as done" is an empty ring — check glyph `opacity:0` until hover, so the action is invisible on desktop | UX | Medium | S |

**Verification highlights:** confirmed via the a11y tree that the row is a single button wrapping the due button; confirmed `document.activeElement` stays on the trigger after opening the popover and that Tab lands on a card *outside* the dialog; measured targets at 22px/21px; reproduced the scroll-dismiss (`scrollTop += 40` closes it); computed all three badge contrast ratios; and confirmed the check icon's resting `opacity` is `0`.

Each finding's `finding.md` includes the exact throwaway tweak used for the improved demo and a concrete fix pointer (file + lines / CSS tokens). Findings 05/06 also flag the relevant UI_STANDARDS violations (§1 tokens, §3 contrast, §4 hover-revealed actions). Browser session closed; scratch seed scripts removed.

The full write-up is in `audit/todos-duedates/_summary.md`.
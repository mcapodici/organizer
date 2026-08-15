Audit complete. Browser session closed. I documented **5 genuine, reproduced issues** in the entries-composer area, each with a spec, a short reproduction video, an annotated screenshot, and an improved artifact (live throwaway tweak or annotated mockup). No source files were modified — only `audit/entries-composer/` docs and media.

## Findings

| # | Title | Type | Severity | Effort |
|---|---|---|---|---|
| 01 | No toolbar control to add/edit/remove a link | UX | **High** | M |
| 02 | "Insert table" nests a table inside a table | Bug | Medium | S |
| 03 | Composer loses focus after Save (and on Edit) | UX | Medium | S |
| 04 | Per-entry Copy/Edit/Delete unreachable by keyboard | UX | Medium | S |
| 05 | TipTap "Duplicate extension names" console spam | Bug | Low | S |

## Highlights

- **01 — No link UI:** The `EntryLink` mark is loaded and typed URLs autolink, but the toolbar has *no* link button, so you cannot link arbitrary selected text, fix a wrong URL, or unlink. Mockup shows a Link button + URL popover.
- **02 — Nested tables:** Clicking "Insert table" while the caret is already in a table inserts a table *inside a cell* (verified `table table` in the DOM). The button also shows a misleading "active" state but never toggles off. Fix: `disabled={inTable}`.
- **03 — Focus loss:** After Save, `document.activeElement` becomes `<body>` (live HUD confirms), breaking rapid note entry; Edit also never focuses the editor. Demonstrated the fix by refocusing `.ProseMirror` after save (HUD flips to ✅ editor).
- **04 — Keyboard trap:** Entry actions use `visibility:hidden` revealed on hover, which removes them from the tab order — keyboard-only desktop users can't Edit/Delete. Fix demoed with `opacity` + `:focus-within`.
- **05 — Console spam:** StarterKit 3.22.5 already bundles Link + Underline, yet both composer and card re-add them → 40 `Duplicate extension names` warnings from one timeline switch.

**Healthy (checked, not reported):** paste sanitization (script stripped, `rel="noopener"` kept), trailing paragraph after tables (no caret trap), global `:focus-visible` on toolbar buttons, touch reveal via `@media (hover: none)`, and the expand overlay respecting header/sidebar.

The full table and methodology are in `audit/entries-composer/_summary.md`.
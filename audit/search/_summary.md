Audit complete. No source files were modified — all writes are documentation and media under `audit/search/`.

# Search area UX audit — 5 findings

I drove the seeded app live (5 timelines / 17 entries, IndexedDB forced) in a dedicated `search-audit` Playwright session, reproduced every issue in the browser, and demonstrated each fix with a throwaway in-page tweak that was discarded on reload.

## Findings

| # | Title | Type | Severity | Effort |
|---|-------|------|----------|--------|
| 01 | Search results cannot be navigated or activated with the keyboard | Bug | High | M |
| 02 | A focused result can't be activated with Enter/Space (mouse-only `onMouseDown`) | Bug | High | S |
| 03 | No "no results" state — an unmatched query shows nothing at all | UX | Medium | S |
| 04 | Matches in the timeline name aren't highlighted — results look unrelated | UX | Medium | S |
| 05 | Internal "Timeline Start" marker entries pollute results | UX | Low | S |

Each folder `audit/search/<NN>-<slug>/` contains `finding.md`, `issue.webm`, `issue-1.png`, and either `improved.webm` (findings 01–02) or both `improved.webm` + `improved-mockup.png` (findings 03–05). The index is at `audit/search/_summary.md`.

## Headline problems
- **Keyboard is fully broken.** Arrow keys do nothing (no active-item highlight, no `aria-activedescendant`), `Enter` in the input opens nothing, and the input/dropdown expose no combobox/listbox roles. Separately, results are wired only to `onMouseDown`, so even Tab-ing onto a result and pressing Enter/Space never fires — verified the route stays put.
- **Silent empty state.** `setOpen(scored.length > 0)` + `open && results.length > 0` means an unmatched query (`wombat`) renders no dropdown and no copy — indistinguishable from idle or broken.
- **Confusing matches.** Searching a timeline name (`acme`) returns 6 results with zero highlight anywhere, because highlighting only runs on the snippet, not the `.timelineName` label. And `isStart` "Timeline Start" markers are indexed — searching `start` returns 5 of 7 results as internal placeholders.

## Notes
- No search-specific console errors. Unrelated console noise outside this area: a `logo.svg` 404 and repeated TipTap "Duplicate extension names (`link`, `underline`)" warnings from the editor.
- Every `finding.md` includes a concrete fix pointer into `src/components/SearchBox/SearchBox.tsx` (and `SearchBox.module.css`) for the later fix run.
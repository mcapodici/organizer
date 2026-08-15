Audit complete. I drove the seeded app in an isolated `tagsaudit` Playwright session (IndexedDB, welcome skipped, same `seedData` fixture) and documented four genuine, reproducible issues in the **tags** area. No source files were changed — only docs + media under `audit/tags/`.

## Findings

**`audit/tags/01-case-insensitive-duplicate-tags/`** — Bug, Medium
`TagInput`'s dedup check (`!tags.includes(trimmed)`) is case-sensitive, so typing `Client` when `client` exists creates a second tag. `useTags` then lists both in the filter as independent chips, silently splitting the tag. Fix pointer: `TagInput.tsx` `addTag()` + `useTags.ts`.

**`audit/tags/02-filter-hidden-when-panel-collapsed/`** — UX, Medium
Collapsing the Filter panel unmounts the whole `TagFilter` (tag chips **and** the Clear button) while `filterTags` stays applied — the list keeps hiding 3 of 5 timelines with only a tiny `1` badge as a cue, and no way to clear without reopening. Verified: no `Clear` in the DOM after collapse.

**`audit/tags/03-filter-not-reflected-in-header/`** — UX, Low
Filtering only affects the sidebar list. The open timeline (Acme Corp) stays fully rendered in the main pane even after being filtered out of the list, with zero indication in the header. Verified: `main h1 = "Acme Corp"` while it's absent from the filtered list.

**`audit/tags/04-filter-tags-missing-aria-pressed/`** — Bug, Medium
`TagFilter` tag toggles carry no `aria-pressed` (verified `null` on every button); selected state is conveyed by indigo colour alone — an assistive-tech gap and a WCAG 1.4.1 concern. The sibling Filter button already sets `aria-pressed` correctly, so this is a straightforward parity fix.

Each folder has `finding.md`, `issue.webm`, annotated `issue-*.png`, plus `improved.webm` + `improved-1.png` from a throwaway in-page tweak (all reverted with `reload`). Summary table with relative links is in `audit/tags/_summary.md`.

Two out-of-area console items surfaced on boot (`404 /logo.svg`, repeated TipTap "Duplicate extension names ['link','underline']" warnings) — noted for context in the summary but not filed as tags findings.
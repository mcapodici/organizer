Audit complete. Browser session closed. Here is the full result.

# Timelines area — UX audit (read-only)

I drove a dedicated `tl-audit` Playwright session against the seeded app (mirroring `e2e/fixtures.ts` + `seedData`, forced onto the IndexedDB adapter to match the seed), reproduced real flows, and filed 4 genuine, reproducible findings under `audit/timelines/`. Each folder has `finding.md`, `issue.webm`, annotated `issue-*.png`, and an `improved.webm`/`improved-1.png` from a throwaway in-page tweak (discarded on reload).

## Findings

| # | Title | Type | Severity | Folder | Effort |
|---|-------|------|----------|--------|--------|
| 01 | App logo is broken everywhere (404 on `/logo.svg`) | Bug | High | `audit/timelines/01-broken-logo-404/` | S |
| 02 | Timeline title is click-to-rename but keyboard-inaccessible with no affordance | UX | Medium | `audit/timelines/02-title-rename-not-keyboard/` | S |
| 03 | Emoji/dingbat glyphs used as UI icons on the tag buttons | Style | Low | `audit/timelines/03-emoji-edit-tags-icon/` | S |
| 04 | Sidebar reorders under you: active timeline jumps to top on every entry edit | UX | Medium | `audit/timelines/04-sidebar-reorders-on-edit/` | M |

### 01 — Broken logo (High, Bug)
Vite serves under `base: '/app/'` (`vite.config.ts:37`) but `src/App.tsx` references `src="/logo.svg"` in three places (header, mobile brand, empty state). Verified: `/app/logo.svg` → 200, `/logo.svg` → 404; all three `<img>` report `naturalWidth === 0`; console logs the 404. Fix: `import.meta.env.BASE_URL`. Throwaway tweak repointing the src made all logos render.

### 02 — Title rename not keyboard-accessible (Medium, UX/a11y)
The header `<h1 class="name">` (`TimelineView.tsx:135`) is click-to-rename but is `tabindex:-1`, `role:null`, no `aria-label`/`title` — keyboard/SR users can't reach it and there's no visible cue it's editable (only a hover underline). A kebab→Rename fallback exists, so it's a discoverability/a11y gap. Demoed by making it a focusable `role="button"` with a focus ring.

### 03 — Emoji icons on tag buttons (Low, Style)
`TimelineView.tsx:145` renders `"✎ Edit tags"` / `"+ Add tags"`. `✎` is U+270E (dingbat, confirmed via codepoint), violating UI_STANDARDS #5 and clashing with the lucide set used everywhere else. Demoed by swapping in a lucide `pencil` SVG.

### 04 — Sidebar reorders on edit (Medium, UX)
Every entry save/rename/tag edit stamps `updatedAt=now` (`useTimelines.ts` + `App.touchActiveTimeline`), and the list sorts "most recently changed first" with no manual/pin ordering — so the row you're editing leaps to the top. Recorded Journal jumping 4→1 on Save. (I normalized the seed's future-dated `updatedAt` to show the production-accurate "jumps to top" direction; documented in the finding.)

## Checked and healthy (not filed)
Delete has a proper confirm modal; kebab is `aria-label`led; global `:focus-visible` and `prefers-reduced-motion` exist in `src/index.css`; empty-name renames are blocked; the kebab dropdown does not clip even with a long scrolling list. I also noted an out-of-area console warning (TipTap "Duplicate extension names: link, underline") that belongs to the editor, not timelines.

Summary table with relative links written to `audit/timelines/_summary.md`.
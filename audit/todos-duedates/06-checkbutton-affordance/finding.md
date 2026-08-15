# "Mark as done" is an empty ring — the check is invisible until hover on desktop

- Area: todos-duedates
- Type: UX
- Severity: Medium
- Screen/route: `#/todos` → `TodoRow` `.checkBtn` / `.checkIcon` (`src/components/TodoPage/TodoPage.tsx:215-223`, `TodoPage.module.css:95-104`)
- Repro:
  1. Boot the seeded app and open `#/todos` on a desktop (mouse, `hover: hover`).
  2. Look at the round control on the left of each row without hovering it.
  3. Hover it.
- Observed: By default the check glyph is `opacity: 0` (`.checkIcon`), so each row shows only an empty circle. An empty ring reads as an unselected radio button, not a "complete this todo" action — nothing hints that clicking it marks the item done. The check only fades in on `:hover`/`:focus-visible` (confirmed: computed icon opacity is `0` at rest, revealed on hover). Touch gets a `@media (hover:none)` fallback, but the common desktop-mouse case is left with a meaningless empty circle until the pointer happens to land on it. See ./issue.webm, ./issue-1.png (resting empty ring) and ./issue-2-hover.png (check appears only on hover). This also brushes UI_STANDARDS §4 (don't rely on hover to reveal actions).
- Expected / proposed: Show the check glyph at rest at a low but visible opacity (≈0.35–0.45), then darken it to full on hover/focus. The empty circle then reads as an actionable, uncompleted checkbox on every pointer type.
- Improved demo: ./improved.webm (also ./improved-mockup.png). Injected `<style>`: `.checkIcon { opacity: .4 }` — the check is now faintly visible at rest and still emphasises on hover. Reloaded to discard.
- Fix pointer: `src/components/TodoPage/TodoPage.module.css:95-104` — change `.checkIcon { opacity: 0 }` to a resting `~0.4` and keep the hover/focus rule bumping it to `1`.
- Effort: S

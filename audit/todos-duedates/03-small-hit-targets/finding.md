# Check button and due-date pill are below the minimum tap-target size

- Area: todos-duedates
- Type: UX
- Severity: Medium
- Screen/route: `#/todos` → `TodoRow` `.checkBtn` and `.dueDate` (`src/components/TodoPage/TodoPage.module.css:71-87`, `150-165`)
- Repro:
  1. Boot the seeded app and open `#/todos`.
  2. Measure the round "Mark as done" button and the due-date pill (getBoundingClientRect).
- Observed: The "Mark as done" button renders at **22×22 px** (`.checkBtn` sets `width/height: 22px`) and the due-date pill at **159×21 px** (only ~21 px tall). Both fall under the WCAG 2.5.8 minimum target size of **24×24 px**, and well under the comfortable 44 px touch target — the two primary actions in each row (complete a todo, edit its due date) are the hardest to hit, especially on touch. See ./issue.webm and ./issue-1.png (both targets outlined red).
- Expected / proposed: Give both controls at least a 24 px (ideally ~40–44 px) hit area. The check button can stay visually small but carry padding/inset to a 40 px target; the due-date pill needs more vertical padding so its clickable box clears 24 px.
- Improved demo: ./improved.webm (throwaway tweak, also ./improved-mockup.png). Injected a `<style>`: `.checkBtn { width:40px; height:40px }` and `.dueDate { min-height:32px; padding: 6px 0; align-items:center }`. Measured check button becomes 40×40. Reloaded to discard.
- Fix pointer: `src/components/TodoPage/TodoPage.module.css` — `.checkBtn` (lines 71-87) width/height; `.dueDate` (lines 150-165) vertical padding/min-height. Keep the icon glyph small while enlarging the hit box (e.g. padding + negative margin, or a fixed 40 px box).
- Effort: S

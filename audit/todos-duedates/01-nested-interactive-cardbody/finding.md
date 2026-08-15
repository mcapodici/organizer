# Todo card body is one giant button that also nests the due-date button

- Area: todos-duedates
- Type: Bug
- Severity: High
- Screen/route: `#/todos` → `TodoPage` `TodoRow` — the `.cardBody` `div[role="button"]` (`src/components/TodoPage/TodoPage.tsx:224-264`)
- Repro:
  1. Boot the seeded app and open `#/todos`.
  2. Inspect the first "Due Now" row with the accessibility tree (or a screen reader).
  3. Observe the entire row body is exposed as a single `button` whose accessible name is `"Chase signed contract from procurement — no reply yet. Acme Corp OVERDUE 12 Aug 2026"`, and that this button *contains* a second `button` ("OVERDUE 12 Aug 2026").
- Observed: `.cardBody` is a `<div role="button" tabIndex=0>` (navigates to the timeline) that wraps the timeline chip and the due-date `<button>`. This is an interactive-inside-interactive control: the outer accessible name swallows the whole card (preview + timeline + status + date), and the inner due-date button is a nested widget — invalid ARIA nesting. A screen-reader user hears one enormous button label and cannot tell the "open" action from the "edit due date" action. See ./issue.webm and ./issue-1.png (red = outer button, blue dashed = nested button).
- Expected / proposed: Do not make the whole card a button. Give the card a plain container, make only the preview text an explicit "open in timeline" control (button or link) with a concise label, and keep the due-date pill as a sibling control. The result is two/three short, distinct, correctly-labelled controls per row instead of one nested giant.
- Improved demo: ./improved.webm (throwaway tweak, also captured as ./improved-mockup.png). Injected via `run-code`: removed `role`/`tabIndex` from `.cardBody`, replaced the preview `<div>` with a `<button aria-label="Open in timeline: …">`, leaving the due pill a sibling. The a11y tree then shows separate `"Open in timeline: …"` and `"OVERDUE 12 Aug 2026"` buttons with no wrapping button. Reloaded to discard.
- Fix pointer: `src/components/TodoPage/TodoPage.tsx:224-264` — drop `role="button"`/`tabIndex`/`onKeyDown` from `.cardBody`; wrap `entryPreview(...)` text in its own button/link; keep the due-date `<button>` as a sibling. `.cardBody` cursor style in `TodoPage.module.css:113-117`.
- Effort: M

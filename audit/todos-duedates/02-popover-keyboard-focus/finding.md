# Due-date popover is not keyboard-reachable — no focus move, no trap, no return

- Area: todos-duedates
- Type: UX
- Severity: High
- Screen/route: `#/todos` → `DueDatePopover` (`src/components/DueDatePopover/DueDatePopover.tsx:83-135`)
- Repro:
  1. Boot the seeded app and open `#/todos`.
  2. Click a due-date pill (e.g. "OVERDUE 12 Aug 2026") to open the popover.
  3. Press Tab.
- Observed: The popover opens with `role="dialog"` but focus is never moved into it — `document.activeElement` stays on the trigger pill. The popover is rendered via `createPortal` to the end of `document.body`, so pressing Tab moves focus to the *next todo card* (the dialog stays visibly open while focus sits behind it), not into the dialog's Today/Tomorrow/date/Mark-done/Remove controls. There is no focus trap and no focus-return on close. A keyboard-only user cannot operate the popover in logical order. See ./issue.webm and ./issue-1.png (red = open dialog, amber dashed = where focus actually landed — a card *outside* the dialog).
- Expected / proposed: On open, move focus to the first control inside the dialog. Trap Tab/Shift+Tab within the dialog while it is open (`aria-modal="true"`). On close (Escape, outside click, or after a selection) return focus to the trigger pill.
- Improved demo: ./improved.webm (throwaway tweak, also ./improved-mockup.png). Injected via `run-code`: set `aria-modal="true"`, focused the first control, and added a `keydown` handler that cycles Tab/Shift+Tab between the first and last focusable controls. Focus then stays inside the dialog. Reloaded to discard.
- Fix pointer: `src/components/DueDatePopover/DueDatePopover.tsx` — add an initial-focus effect and a Tab focus-trap (or a small `focus-trap` helper), set `aria-modal="true"`, and store/restore the trigger element on close. The trigger `<button>` lives in `src/components/TodoPage/TodoPage.tsx:234-254`.
- Effort: M

# Undo bar is not keyboard reachable — focus is never moved to it

- Area: undo
- Type: Bug
- Severity: High
- Screen/route: `#/todos` (and any timeline) — `src/context/UndoContext.tsx` renders `<UndoBar>` after `{children}`; `src/components/UndoBar/UndoBar.tsx`
- Repro:
  1. Seed the app (5 timelines / 17 entries) and open `#/todos`.
  2. Using the keyboard, move focus to a todo's "Mark as done" button and activate it (Space/Enter).
  3. The row disappears and the "Marked done" undo bar animates in at bottom-left.
  4. Try to reach the "Undo" button from the keyboard.
- Observed: After the row is removed, `document.activeElement` is `<body>` — focus is dropped entirely (see ./issue.webm; ./issue-1.png). The undo bar is rendered at the very end of the DOM (after the whole app), so a keyboard user cannot reach "Undo" without Tabbing forward through the entire header, sidebar and todo list — and the 10s window expires long before they get there. Pressing Tab twice lands on a todo card, never on Undo. There is no keyboard shortcut and no focus move. The label is `role="status"` so a screen-reader user hears "Marked done" but is given no reachable control before it vanishes.
- Expected / proposed: When the undo bar appears after a keyboard-initiated action, move focus to the "Undo" button (or expose a documented shortcut, e.g. Ctrl/Cmd+Z, that runs the pending undo). The button must have a visible focus ring (per UI_STANDARDS §2). Returning focus somewhere sensible after undo/expiry is also required.
- Improved demo: ./improved.webm (throwaway tweak: injected a `MutationObserver` that calls `.focus()` on the "Undo" button when the bar mounts, plus a `button:focus{outline:3px solid #6366f1}` style; then marked a todo done and pressed **Enter** to undo without touching the mouse). Reloaded afterwards to discard.
- Fix pointer: `src/context/UndoContext.tsx` (focus the Undo button on register, restore focus on clear) and/or `src/components/UndoBar/UndoBar.tsx` (autofocus + focus-visible style, `tabIndex`/`ref`). Consider a global keyboard handler for Ctrl/Cmd+Z bound to the pending undo.
- Effort: M

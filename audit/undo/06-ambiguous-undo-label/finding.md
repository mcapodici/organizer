# Undo labels never name the affected item ("Marked done" — which one?)

- Area: undo
- Type: UX
- Severity: Low
- Screen/route: `#/todos` and timelines — `src/utils/todoUndo.ts` `describeTodoChange`; rendered by `src/components/UndoBar/UndoBar.tsx`
- Repro:
  1. Seed the app and open `#/todos` (6 todos).
  2. Mark any todo done.
  3. Read the undo bar label.
- Observed: The label is a bare verb phrase — "Marked done", "Due date removed", "Due date changed to 20 Aug 2026" — with no reference to *which* todo it applied to (verified: the only `role="status"` text is exactly "Marked done" — see ./issue.webm; ./issue-1.png). The row disappears the instant it is marked done, so once it is gone the user has no way to confirm what "Undo" will bring back — especially after marking several in a row, or navigating away from `#/todos` (the bar persists across routes). This weakens trust in the control precisely when it is destructive.
- Expected / proposed: Include a short item identifier in the label, e.g. `Marked done · Long run — 18 miles` (truncated). The composer already derives an `entryPreview` for todo rows (`src/components/TodoPage/TodoPage.tsx`), so the text is available.
- Improved demo: ./improved.webm / ./improved-1.png (throwaway tweak: a `MutationObserver` rewrote the bar label to `Marked done · Long run — 18 miles` when it appeared). Reloaded to discard.
- Fix pointer: `src/utils/todoUndo.ts` `describeTodoChange` — accept/return a preview snippet and append it; or have the caller in `src/components/TodoPage/TodoPage.tsx` / `src/App.tsx` pass the entry preview into `registerUndo`. Keep the label to one line (the bar already ellipsis-truncates).
- Effort: S

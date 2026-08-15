All artifacts are in place and the browser is closed. Here is the complete result.

# Undo audit — complete

Read-only audit of the app's undo affordances (`UndoContext`, `UndoBar`, `Toast`, and the delete/edit flows). Seeded 5 timelines / 17 entries straight into IndexedDB via the exported `seedData`. **Harness note:** the app now always prefers OPFS when `navigator.storage.getDirectory` exists and *ignores the `storageMode` localStorage key*, so I had to strip `getDirectory` (the `forceIdb` trick from `e2e/fixtures.ts`) before the seeded IDB was read — `seed-and-shoot.mjs`'s `storageMode='idb'` alone is now a no-op.

All six issues were reproduced live. Each folder under `audit/undo/<NN>-<slug>/` has `finding.md`, `issue.webm`, `issue-1.png`, and an improved artifact (live throwaway tweak `improved.webm`, or `improved-mockup.png` where a live fix wasn't practical).

## Findings

| # | Title | Type | Severity | Effort | Folder |
|---|---|---|---|---|---|
| 01 | Undo bar is not keyboard reachable — focus never moved to it (lands on `<body>`; bar is at DOM end; 10s window expires before it can be tabbed to) | Bug | High | M | `audit/undo/01-focus-not-moved-to-undo/` |
| 02 | A second undoable action silently discards the first — single slot; rapid triage can only reverse the last action | UX | Medium | M | `audit/undo/02-undo-superseded-loses-first/` |
| 03 | Deleting an entry offers no undo, only a "cannot be undone" modal — inconsistent with todos | UX | High | M | `audit/undo/03-no-undo-for-entry-delete/` |
| 04 | Deleting a timeline destroys it + all entries with no undo (the most destructive, least recoverable action) | UX | High | L | `audit/undo/04-no-undo-for-timeline-delete/` |
| 05 | On mobile the undo bar goes full-width and is covered by the merge toast (z 10000 > 9500); breaks the desktop anti-collision design | Bug | Medium | S | `audit/undo/05-mobile-undo-toast-overlap/` |
| 06 | Undo labels never name the affected item ("Marked done" — which one?) | UX | Low | S | `audit/undo/06-ambiguous-undo-label/` |

## Two dominant themes
- **Undo only covers reversible todo field flips.** The genuinely destructive, irreversible actions (delete entry, delete timeline + all notes) get only a modal and no undo (03, 04). For each I demonstrated a working throwaway restore that re-`put`s the deleted record(s) back into IndexedDB — proving the fix is small.
- **The undo bar is not accessible.** Focus is never moved to it and it renders after the whole app in the DOM, so keyboard/screen-reader users can't reach "Undo" before it expires (01). Fix demoed by auto-focusing the button + pressing Enter.

## Hard evidence highlights
- Finding 01: after marking done, `document.activeElement === <body>`; two Tabs land on a todo card, never on Undo.
- Finding 02: marked "Chase…" then "Pay deposit…" done; Undo restored only "Pay deposit" — "Chase" was permanently lost.
- Findings 03/04: no `Undo` control exists in the DOM after delete; entry/timeline counts confirm permanent loss, and the injected undo restored them.
- Finding 05: at 390px, undo bar width 358 (right edge 374) overlaps toast (left 67) → `overlap: true`, bar `z-index 9500` under toast `10000`.

## Out of scope but observed
Console logs a repeated `404` for `/logo.svg` on every load — unrelated to undo, not filed as a finding.

Files I wrote are supporting artifacts under `audit/undo/`; this message is the audit deliverable. No source files were changed.
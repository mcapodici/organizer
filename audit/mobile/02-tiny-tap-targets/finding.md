# Composer, toolbar and entry controls are far below the 44px touch-target minimum

- Area: mobile
- Type: UX
- Severity: Medium
- Screen/route: `#/timelines/<id>` — `EntryComposer` toolbar + footer (`src/components/EntryComposer/*`) and `EntryCard` action/todo controls (`src/components/EntryCard/*`).
- Repro:
  1. Seed the app and open the **Acme Corp** timeline at a phone viewport (390×844, touch).
  2. Look at the "New Note" composer toolbar and footer, and any entry's action row.
  3. Try to tap the formatting buttons, the "Set custom time" / "Set due date" links, or Copy/Edit/Delete.
- Observed: Measured hit areas on mobile (via `getBoundingClientRect`):
  - Editor toolbar buttons (Bold, Italic, H1…Insert table): **28×24 px** (`.toolBtn`, padding `4px 6px`).
  - Composer "Set custom time" / "Set due date": **~97×15 / ~76×15 px** (only 15 px tall — `.customTimeBtn`).
  - "Expand editor": **22×18 px**.
  - Entry Copy/Edit/Delete: **~40–55×21 px** (`.actionBtn`, padding `2px 8px`).
  - Todo "Mark as done" checkbox: **24×19 px** (`.todoCheckBtn`).
  All are well under the 44×44 px touch minimum (WCAG 2.5.5 / Apple HIG / Material). On a real phone these are easy to mis-tap, and the 15px-tall date links are especially hard. See ./issue.webm and ./issue-1.png.
- Expected / proposed: Interactive controls should present at least a 44×44 px touch area on touch devices (a transparent padded hit area is fine — the visual icon can stay small). Apply via a `@media (hover: none)` / `(pointer: coarse)` block so the desktop layout is unaffected.
- Improved demo: ./improved.webm (throwaway tweak: injected `min-width/min-height:44px` + extra padding on `[class*="_toolBtn_"]`, `[class*="_actionBtn_"]`, `[class*="_customTimeBtn_"]`, `[class*="_todoCheckBtn_"]`). Targets grow to ≥44px and the toolbar stays usable (it already wraps). Tweak discarded via `reload`.
- Fix pointer: `EntryComposer.module.css` `.toolBtn` (line 75), `.customTimeBtn` (line ~358), `.expandBtn` (line 48); `EntryCard.module.css` `.actionBtn` (line 88) and `.todoCheckBtn` (line ~261). Add a coarse-pointer media block bumping `min-height`/`min-width` to 44px.
- Effort: M

# Per-entry Copy/Edit/Delete are unreachable by keyboard on desktop

- Area: entries-composer
- Type: UX
- Severity: Medium
- Screen/route: `#/timelines/<id>` — `EntryCard` actions cluster (`src/components/EntryCard/EntryCard.tsx:124-130`, styled in `EntryCard.module.css:70-86`)
- Repro:
  1. Open the Acme Corp timeline (seeded).
  2. Do not use the mouse. Press Tab repeatedly from the top of the page.
  3. Watch where focus lands (the video has a live "Tab focus →" HUD).
- Observed: Focus moves through the header, sidebar timelines, tags and the
  composer, but never lands on any entry's **Copy / Edit / Delete** buttons. They
  are `visibility: hidden` at rest and only revealed by `.card:hover`
  (EntryCard.module.css:70-79). `visibility: hidden` also removes them from the
  tab order, so a keyboard-only desktop user cannot edit or delete an entry at
  all. `focus()` on the button fails (`document.activeElement` does not become
  it). The existing `@media (hover: none)` rule (line 82) fixes touch but not
  desktop keyboard. See ./issue.webm and ./issue-1.png.
- Expected / proposed: The actions must be reachable by keyboard on desktop. Keep
  them visually hidden at rest but in the tab order, and reveal them on hover
  **and** `:focus-within` (and on individual button focus).
- Improved demo: ./improved.webm and ./improved-1.png — throwaway tweak: injected
  CSS replacing `visibility:hidden` with `opacity:0` (staying in the tab order)
  plus `.card:hover/.card:focus-within .actions { opacity:1 }` and a
  `:focus-visible` ring. The Edit button then focuses via keyboard and becomes
  visible (HUD reads "Tab focus → Edit entry"; `focused:true, visibility:visible`).
  Discarded with `reload`.
- Fix pointer: `src/components/EntryCard/EntryCard.module.css:70-86` — swap
  `visibility: hidden` → `opacity: 0` (keep it focusable), reveal via
  `.card:hover .actions, .card:focus-within .actions { opacity: 1 }`, and add a
  focus style for the buttons.
- Effort: S

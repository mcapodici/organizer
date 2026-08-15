# Timeline title is click-to-rename but keyboard-inaccessible with no affordance

- Area: timelines
- Type: UX
- Severity: Medium
- Screen/route: `#/timelines/<id>` — `TimelineView` header title. Element: `<h1 class="name" onClick=…>` (`src/components/TimelineView/TimelineView.tsx:135`).
- Repro:
  1. Open a seeded timeline (e.g. Acme Corp).
  2. Look at the title "Acme Corp" — it looks like ordinary heading text.
  3. Click it — it silently turns into an editable rename input.
  4. Now try to reach it with the keyboard: Tab through the header/search. Focus never lands on the title.
- Observed: The title is an interactive rename control disguised as static text. It has `tabindex = -1`, `role = null`, no `aria-label`, and no `title`/tooltip, so:
  - Keyboard and screen-reader users cannot discover or trigger the header rename at all.
  - Sighted mouse users get no hint that the heading is clickable (the only cue is a hover underline that appears after you already hover it).
  See ./issue.webm (clicking reveals the hidden editor; Escape cancels) and ./issue-1.png (title outlined). There is a secondary rename path via the row kebab → Rename, so this is a discoverability/a11y gap rather than a total block.
- Expected / proposed: Make the editable title a real, focusable, labelled control with a persistent affordance:
  - Render the trigger as a `<button>` (or add `role="button"` + `tabindex="0"` + `onKeyDown` for Enter/Space) so it is in the tab order and screen-reader-announced.
  - Add an `aria-label`/`title` such as "Rename timeline".
  - Show a persistent edit affordance (a lucide `Pencil` icon — not an emoji, per UI_STANDARDS #5) so the click target is discoverable.
- Improved demo: ./improved.webm and ./improved-1.png (throwaway tweak: set `tabindex=0`, `role="button"`, `aria-label`, `title` on the `<h1>`, added a `:focus-visible` outline, and focused it to show the keyboard focus ring; a "✎" hint was injected only to illustrate an affordance — the real fix should use a lucide icon). Tweak discarded via reload.
- Fix pointer: `src/components/TimelineView/TimelineView.tsx:135` (the `<h1 className={styles.name}>` click handler) and `src/components/TimelineView/TimelineView.module.css` `.name` (add `:focus-visible` styling; add an icon element). Consider a lucide `Pencil` import.
- Effort: S

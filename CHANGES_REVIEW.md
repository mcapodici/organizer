# Changes for Review — UI Standards Pass

This documents every change made while applying `UI_STANDARDS.md`. **Nothing is
committed** — it's all in the working tree for you to review and test.

To run it: `npm run dev`. Type-check passes (`npx tsc --noEmit -p tsconfig.app.json` → exit 0).

23 files changed. They fall into two groups: a critical bug fix, and the
standards work (#1–#10 from `UI_STANDARDS.md`, excluding #7 which was a
no-change-by-design item).

---

## 1. Critical bug fix (separate from the standards work)

**`src/context/StorageContext.tsx`**

The app rendered a **blank white page on every fresh load**. React threw
*"Rendered fewer hooks than expected"* because the 2-second conflict-polling
`useEffect` sat **after** the early `return <Home/>` for the `home` phase. On a
fresh load `phase` is `home`, so that hook was skipped → hook order changed →
crash.

**Fix:** moved the polling `useEffect` above the early returns so the hook order
is stable across every phase. No behavior change otherwise.

> This was found first (it blocked the whole review). It is a real functional
> bug, not cosmetic — worth verifying carefully.

---

## 2. Design tokens (UI_STANDARDS.md #1)

**`src/index.css`** — added a `:root` block of CSS custom properties: accent
palette, text scale, surfaces/borders, danger colors, and radii. Then migrated
**every component CSS file** to reference these tokens instead of hard-coded hex
values.

- Repeated values like `#6366f1`/`#4f46e5` (accent), the gray scale, and the
  `#e5e7eb`/`#d1d5db` borders are now single-sourced.
- The `.btn` / `.btnSecondary` / `.dangerBtn` definitions still live per-file
  (not consolidated into shared classes yet — that's a larger refactor), but
  they now all draw from the same tokens, so they can't drift in color.

**Intentional small visual unifications** (worth a glance):

- The tag chip in `TagInput` was a slightly different indigo (`#e0e7ff` /
  `#3730a3`); it now uses the accent family for consistency.
- A handful of muted captions got slightly darker — see #4 below.

**Left as literal values on purpose** (low-frequency, semantic — not part of the
core palette): the todo status colors (overdue amber, done green, "soon" blue,
"today" amber) in `EntryCard`, `TodoPage`; the highlight yellow `#fef08a`; and
the hero/overlay gradient rgba values. These can be tokenized later if you want,
but doing so now risked muddying their meaning.

---

## 3. Visible focus states (UI_STANDARDS.md #2)

- **`src/index.css`** — added a global `:focus-visible` outline so every
  interactive element (especially buttons, which previously had **none**) shows
  a keyboard-focus ring.
- **`TagInput.module.css`** — the text input is nested in a `.field` box; added
  `.field:focus-within` so focusing it highlights the box.
- **`EntryComposer.module.css`** — added `.composer:focus-within` so the editor
  shows a focus border when active.

Inputs that already set `outline: none` keep their own `:focus` border/box-shadow,
so they're unaffected.

---

## 4. Text contrast (UI_STANDARDS.md #3)

Muted text that was meant to be *read* but sat at `#9ca3af` (~2.5:1, below WCAG
AA) was bumped to `--text-subtle` (`#6b7280`, ~4.5:1+). Affected:

- the "No backup" nudge and empty-state text (`App.module.css`)
- search result dates (`SearchBox`)
- todo empty-state text (`TodoPage`)
- the loading text and option descriptions (`WorkspacePicker`)
- the tag-filter section label (`TagFilter`)
- attachment placeholder / file size (`EntryCard`)

Genuinely decorative greys (placeholders, icon tints, dividers, ellipsis) were
left as `--text-faint`.

---

## 5. Hover-only actions reachable on touch (UI_STANDARDS.md #4)

**`EntryCard.module.css`** — the Copy/Edit/Delete actions were `visibility:
hidden` and only shown on `.card:hover`, making them unreachable on touch.
Added `@media (hover: none) { .actions { visibility: visible } }`.

Same pattern applied to the new todo check icon (see #6) via `@media (hover: none)`.

---

## 6. Real icons instead of emoji/glyphs (UI_STANDARDS.md #5)

Replaced emoji and symbol glyphs used as UI with `lucide-react` icons:

| Where | Was | Now |
|-------|-----|-----|
| Onboarding storage choice (`WorkspacePicker.tsx`) | 📁 / 🌐 | `Folder` / `Globe` |
| Workspace list item (`WorkspacePicker.tsx`) | 📄 | `FileText` |
| Settings "Current storage" (`Settings.tsx`) | 📁 / 🌐 | `Folder` / `Globe` |
| Header workspace chip (`App.tsx`) | 📁 | `Folder` |
| "No timeline selected" empty icon (`App.tsx`) | ◎ | `CircleDot` |
| Attachment download link (`EntryCard.tsx`) | 📎 | `Paperclip` |
| Entry todo lozenge check (`EntryCard.tsx`) | ✓ / ○ | `Check` / `Circle` |
| Todos "all caught up" icon (`TodoPage.tsx`) | ✓ | `CheckCircle2` |
| Todo row check button (`TodoPage.tsx`) | ○ | `Check` (appears on hover) |
| Sidebar new-timeline button (`TimelineList.tsx`) | + | `Plus` |
| Sidebar timeline kebab (`TimelineList.tsx`) | ⋮ | `MoreVertical` |

**Behavior note on the todo-row check button:** previously a static `○`. Now an
empty bordered ring with a `Check` that fades in on hover/focus (and is always
shown on touch) to hint the "mark done" action. Worth eyeballing that this feels
right.

> Left as-is: the `⋮` inside the welcome guide *text* (`welcome.ts`) — that's
> user-facing copy describing the menu, not a control.

---

## 7. Reduced motion (UI_STANDARDS.md #6)

**`src/index.css`** — added a `@media (prefers-reduced-motion: reduce)` block
that neutralizes animations/transitions for users who request it.

---

## 8. (UI_STANDARDS.md #7 — mobile drawer) — no change

Left full-width by design, per your note that it benefits search. Documented in
the standards file; no code touched.

---

## 9. Removed caret/cursor hacks (UI_STANDARDS.md #8)

**`EntryComposer.module.css`** — removed the custom SVG I-beam `cursor:
url(...)` on the editor and the `caret-color` override on `.ProseMirror`.
**`SearchBox.module.css`** — removed the `caret-color` override on the input.

These addressed a machine-specific issue (yours), not a real cross-platform
problem, so per the standard they're gone rather than preserved. **Please sanity
check the editor caret looks normal on your machine now.**

---

## 10. Breakpoints (UI_STANDARDS.md #9)

No values changed (changing them risked regressing the landing page). Added a
comment in `Home.module.css` documenting why its grid uses `900px` while the
canonical mobile step elsewhere is `768px`. The existing set (600 / 768 / 900)
is now treated as the documented scale.

---

## 11. Border override cleanup (UI_STANDARDS.md #10)

**`EntryCard.module.css`** — `.todoDueBtn` set `border-left: 1px solid
currentColor` then immediately overrode the color with an rgba. Now sets the
final rgba color directly in one declaration.

---

## Suggested testing checklist for the morning

- [ ] Fresh load (clear site data / new browser profile) → app renders, no blank
      page. *(critical fix)*
- [ ] Tab through buttons/links → visible focus ring everywhere.
- [ ] Onboarding, Settings, sidebar, attachments, todos → icons render (no tofu
      boxes), nothing misaligned.
- [ ] Editor caret/cursor looks normal while typing.
- [ ] Todo check button on a real todo → empty ring, check on hover, toggles done.
- [ ] Mobile width (DevTools device toolbar) → entry Copy/Edit/Delete visible
      without hover.
- [ ] Spot-check colors look unchanged vs. before (tokens should be 1:1 except
      the intentional unifications in #2 and contrast bumps in #4).

## Housekeeping note

`.playwright-mcp/` (screenshot output from the review tooling) is **not** in
`.gitignore`. Consider adding it before committing.

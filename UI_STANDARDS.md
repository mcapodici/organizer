# UI Standards

Design and front-end conventions for Organizer. These exist to keep the look
coherent and the app accessible as it grows. New components and changes should
follow them; existing code should be migrated toward them opportunistically.

The visual language is already solid — a consistent indigo accent, a sensible
gray scale, even border-radius rhythm, and tasteful empty states. The goal of
this document is to make that system *explicit* rather than implicit.

---

## 1. Use design tokens, not copy-pasted values

The accent indigo (`#6366f1` / hover `#4f46e5`), the gray scale, and the
`.btn` / `.btnSecondary` / `.dangerBtn` button trio are currently redeclared
across many files (App, TimelineView, TimelineList, Settings, Home). The same
button is defined five or more times.

**Standard:**

- Define shared values as CSS custom properties in `src/index.css`, e.g.
  `--accent`, `--accent-hover`, `--danger`, `--danger-hover`, `--gray-500`,
  `--radius`, etc.
- Reference the tokens everywhere instead of hard-coded hex values.
- Share the button classes rather than re-declaring them per component.

This is the highest-leverage change for maintainability and is a prerequisite
for consistent theming.

---

## 2. Always provide a visible focus state

Several files set `outline: none`, but only a few inputs add a `:focus` ring
back, and **no button currently has a visible focus state**. Keyboard users
cannot see where they are.

**Standard:**

- Never remove an outline without replacing it.
- Add a global focus style and rely on it:

  ```css
  :focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  ```

- Interactive elements (buttons, links, inputs, custom controls) must show a
  clear focus indicator.

---

## 3. Meet contrast minimums for text

Small text in `#9ca3af` on white (e.g. the backup nudge, empty-state text,
search result dates, various captions) lands around ~2.5:1, below the WCAG AA
threshold of 4.5:1 for body text.

**Standard:**

- Any text intended to be *read* must meet **4.5:1** contrast against its
  background. Darken muted text to around `#6b7280` or stronger.
- `#9ca3af` and lighter are acceptable only for non-essential decoration, not
  for content.

---

## 4. Don't rely on hover to reveal actions

Entry actions (Copy / Edit / Delete) are hidden via `visibility: hidden` and
revealed on `.card:hover`. Touch devices have no hover, so these actions are
effectively unreachable on mobile.

**Standard:**

- Any action revealed on hover must have a non-hover path to it.
- Either show the actions (dimmed) on touch via `@media (hover: none)`, or
  expose them through a kebab/overflow menu (as the timeline rows already do).

---

## 5. Use real icons, not emoji, for UI

Emoji used as interface icons (📁 and 🌐 in onboarding, settings, and the
workspace chip) render inconsistently across operating systems and clash with
the otherwise-clean lucide icon set.

**Standard:**

- Use lucide icons (or assets from `public/icons.svg`) for all UI affordances.
- Reserve emoji for user-authored content only, never for chrome.

---

## 6. Respect `prefers-reduced-motion`

The app has transforms and transitions (feature cards lift on hover, buttons
translate on press). There is currently no reduced-motion guard.

**Standard:**

- Wrap non-essential motion so it is disabled for users who request it:

  ```css
  @media (prefers-reduced-motion: reduce) {
    * {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
  ```

  (or scope it per component as appropriate).

---

## 7. The mobile drawer is intentionally full-width

The mobile sidebar drawer is full-width (`width: 100%`) by design. This gives
search the room it needs to work well on small screens — the full-width layout
lets search results and inputs use the entire viewport rather than being
cramped into a narrow panel.

**Standard:**

- Keep the mobile drawer full-width. Do **not** convert it to a partial-width
  drawer; the extra width is a deliberate trade-off in favor of the search
  experience.

---

## 8. No caret / cursor hacks

The editor previously used custom I-beam cursor and `caret-color` workarounds.
These were addressing a problem that turned out to be specific to one
developer's machine, not a real cross-platform issue.

**Standard:**

- Do not add custom cursor or caret hacks. Rely on default browser/OS behavior.
- Existing caret/cursor hacks should be removed rather than preserved.

---

## 9. Standardize on a single breakpoint scale

Media-query breakpoints currently vary across files (`768px`, `900px`,
`600px`) without a shared scale.

**Standard:**

- Once tokens exist (see #1), settle on a small, documented set of breakpoints
  and use them consistently across all components.

---

## 10. Keep border/divider colors direct

Constructs like `.todoDueBtn` set `border-left: 1px solid currentColor` and
then override it with an rgba value, which means the `currentColor` line
briefly applies.

**Standard:**

- Set divider and border colors to their final value directly. Avoid
  declaring a color you immediately override.

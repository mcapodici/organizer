Review complete. Fragment written to `reviews/_fragments/B-usability-a11y.md`. Below is the full result.

# B — Usability / UX & Accessibility

Scope: `src/components/*`, `src/App.tsx`, `UI_STANDARDS.md`. Read-only; no code changed.

## 1) Usability / UX

### [Severity: Critical] "Clear all data" deletes nothing
- Evidence: `src/components/Settings/Settings.tsx:39-42` — `handleReset` only calls `setResetModalOpen(false)` and `navigate('/')`. The modal (`Settings.tsx:155-167`) promises permanent deletion of all timelines/entries/attachments. Proof no bulk-clear even exists: `grep` of `src/storage/interface.ts` yields only `deleteTimeline`, `deleteEntry`, `deleteEntriesForTimeline`, `deleteBlob` — no `clearAll`; and `StorageContext.tsx:97` says resetStorage is intentionally omitted.
- Why it matters: Users think their data is wiped (e.g. before sharing a device) but everything stays on disk — a privacy/trust failure.
- Trade-offs: (1) implement a real `clearAll()` across both adapters + call it; (2) short-term remove/disable the button.
- Suggested direction: Option 1; if it can't ship now, take option 2 rather than keep the deceptive button.

### [Severity: High] Search results unreachable by keyboard
- Evidence: `SearchBox.tsx:144-148` binds selection only to `onMouseDown` (no `onClick`, no arrow-key/combobox handling). Tabbing to a result and pressing Enter fires `click`, not `mousedown` → nothing happens.
- Why it matters: Search is a primary nav surface; keyboard/SR users can't open any result.
- Trade-offs: (1) add `onClick` alongside `onMouseDown`; (2) full combobox with listbox/option roles + arrow keys.
- Suggested direction: Option 1 now, option 2 later.

### [Severity: Medium] Timeline title edit is mouse-only
- Evidence: `TimelineView.tsx:135-137` — rename triggered by clicking a bare `<h1>` (no tabIndex, no key handler, no affordance). Rename is also reachable via sidebar kebab, so not a total block.
- Suggested direction: Add an explicit edit button matching the existing "Edit tags" pattern.

### [Severity: Medium] Image lightbox can't be closed by keyboard
- Evidence: `EntryCard.tsx:144-148` overlay closes on click only (no Escape, not focused, no dialog role); opener is an `<img onClick>` (`:214-220`), not a button.
- Suggested direction: Route the lightbox through the shared `Modal` and promote the thumbnail to a button.

### [Severity: Low] Emoji/text glyphs as UI chrome (violates UI_STANDARDS #5)
- Evidence: `Modal.tsx:31`, `EntryComposer.tsx:275,313,362,369`, `TimelineView.tsx:145`, `Toast.tsx:54` use `✕`/`×`/`✎`/`+` while UndoBar/Settings use lucide icons.
- Suggested direction: Standardize on lucide `X`.

### [Severity: Low] Toast bypasses design tokens (violates UI_STANDARDS #1)
- Evidence: `Toast.tsx:36-52` hard-codes `#fff`/`#e5e7eb`/`#111827`/`#6b7280`/`#9ca3af` instead of the tokens defined in `index.css:23-42`.
- Suggested direction: Extract a `Toast.module.css` using tokens.

### Looks OK (Usability)
- Undo lands writes immediately then offers a 10s revert (`App.tsx:100-114`, `TodoPage.tsx:98-112`).
- Import replace/merge confirm names the file (`Settings.tsx:133-153`).
- Thoughtful empty states (`App.tsx:329-360`, `TodoPage.tsx:133-143`).
- Hover-only entry actions have a `@media (hover: none)` fallback (`EntryCard.module.css:81-86`) per UI_STANDARDS #4.
- Composer preserves/restores an in-progress draft (`EntryComposer.tsx:84-130`); Save disabled when empty/saving.
- Copy-into-draft guards unsaved work (`TimelineView.tsx:174-180`).

## 2) Accessibility

### [Severity: High] Modal has no focus management or focus trap
- Evidence: `Modal.tsx:10-37` sets `role="dialog"`/`aria-modal`/Escape but never focuses the dialog on open, never restores focus on close, never traps Tab (`ref` used only for `stopPropagation`). Affects every modal.
- Why it matters: `aria-modal="true"` claims the background is inert, yet focus stays behind it and Tab escapes.
- Suggested direction: Add focus-on-open, Tab trap, and focus restore in the shared `Modal`.

### [Severity: Medium] Todo card uses nested-interactive `role="button"`
- Evidence: `TodoPage.tsx:224-262` — a `role="button"` div contains a real `<button>` (due-date editor) + popover; key handler fires only on Enter, not Space.
- Suggested direction: Restructure so navigation and due-date editing are sibling controls, using an `<a>`/`<button>` for navigation.

### [Severity: Medium] Overdue badge distinguished by color alone
- Evidence: `TimelineList.tsx:116-120` + `TimelineList.module.css:187-189` (and `App.tsx:338-341`) — same count number, only red background differs, no `aria-label`. WCAG 1.4.1.
- Suggested direction: Add an `aria-label` (e.g. "3 todos, 2 overdue") plus a non-color glyph.

### [Severity: Low] Composer date/time inputs lack a programmatic name
- Evidence: `EntryComposer.tsx:261-278` datetime input's only label sibling is the `✕` button; the due-date block (`:289-315`) wraps several controls in one ambiguous `<label>`.
- Suggested direction: Add explicit `aria-label` per input.

### [Severity: Low] Attachment thumbnails non-semantic; generic alt
- Evidence: `EntryCard.tsx:214-221` clickable `<img>` (no keyboard access); lightbox alt is `"Full size"` (`:146`) though `attachment.name` is available.
- Suggested direction: Button-wrap thumbnail; derive alt from the attachment name.

### Looks OK (a11y)
- Global `:focus-visible` (`index.css:80-83`); every `outline: none` pairs with a replacement ring — UI_STANDARDS #2 met.
- `prefers-reduced-motion` guard incl. `scroll-behavior` (`index.css:86-93`) — #6 met.
- Icon-only controls carry `aria-label` (burger, kebab, todo check, expand, dismiss, resizer with `role="separator"` + arrow-key resize).
- Toasts `role="status"`, never auto-dismiss (`Toast.tsx:23-35`).
- UndoBar labels via `role="status"`, countdown `aria-hidden` (`UndoBar.tsx:35-36`).
- `DueDatePopover` is a proper dialog with Escape/outside-click/scroll dismiss and viewport flip.
- Decorative logos `alt=""`, meaningful brand logo `alt="Organizer"`.

## Top 3 priorities for this fragment
1. **Critical — "Clear all data" is a no-op** (`Settings.tsx:39-42`): wire a real `clearAll()` or pull the button.
2. **High — Search results keyboard-inaccessible** (`SearchBox.tsx:144-148`): add `onClick`/combobox semantics.
3. **High — Modals lack focus trap/restore** (`Modal.tsx:10-37`): fix once in the shared component.
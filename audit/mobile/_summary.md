All webm files carry the valid EBML/WebM magic (`1a45dfa3`), and the browser is closed. The mobile audit is complete.

## Mobile UX Audit — Summary

I drove the app at a phone viewport (390×844, touch, mobile UA) via a named playwright-cli session (`mobaudit`), forcing IndexedDB + skip-welcome and seeding the realistic `seedData` dataset. I re-ran the core flows (timeline, add entry, todos, search, settings, fullscreen composer, kebab menu). Todos, search, settings, the due-date popover and the kebab menu all held up on mobile. **Four** genuine, reproducible issues stood out, each documented under `audit/mobile/<NN>-<slug>/` with `finding.md`, `issue.webm`, `issue-1.png`, and an `improved.webm` (throwaway in-page tweak, discarded via reload — no source files touched).

| Title | Type | Severity | Folder | Effort |
|-------|------|----------|--------|--------|
| Entry Copy/Edit/Delete clip off-screen on to-do entries (Delete unreachable) | Bug | High | audit/mobile/01-entry-actions-clipped | S |
| Composer/toolbar/entry controls below the 44px touch-target minimum | UX | Medium | audit/mobile/02-tiny-tap-targets | M |
| Header/app logo is a broken image (`/logo.svg` ignores `/app/` base) | Bug | Medium | audit/mobile/03-broken-logo-image | S |
| Fullscreen composer header overlapped by the fixed hamburger button | Style | Low | audit/mobile/04-fullscreen-editor-menu-overlap | S |

### Highlights
- **01 (High):** On any entry with a due-date badge, the `.meta` flex row (no wrap) overflows 390px so **Delete** lands at `right=442px`; the document does not scroll horizontally (`scrollWidth=390`), making Delete completely unreachable on touch. Fix: `flex-wrap: wrap` on `.meta` (`EntryCard.module.css:51`) or an overflow menu. Verified the wrap fix live.
- **02 (Medium):** Measured hit areas — toolbar 28×24, "Set custom time/due date" only **15px tall**, expand 22×18, entry actions 21px tall, todo checkbox 24×19 — all under 44×44. Fix via a `(pointer: coarse)` block bumping min sizes.
- **03 (Medium):** `<img src="/logo.svg">` ignores Vite's `/app/` base → 404 broken image (confirmed `curl /app/logo.svg`=200, `/logo.svg`=404). Fix: `` `${import.meta.env.BASE_URL}logo.svg` `` in `App.tsx` (192/250/331) + `AppBanner.tsx:14` (and update `App.test.tsx:74`).
- **04 (Low):** Fullscreen composer (`z-index:20`) is overlapped by the fixed `.mobileBurger` (`z-index:30`), hiding "NEW" of the "NEW NOTE" title. Fix: indent `.expanded .composerLabel` or hide the burger while expanded.

Console findings recorded in `_summary.md`: recurring `/logo.svg` 404 (finding 03) and a repeated TipTap `Duplicate extension names found: ['link', 'underline']` warning (StarterKit already bundles those, re-added in `EntryCard.tsx`/`EntryComposer.tsx`).

`audit/mobile/_summary.md` contains the intro + linked table. All writes were confined to `audit/mobile/`; harness files live in `/tmp/mobaudit/`, and the browser session is closed.
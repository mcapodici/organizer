# Ideas

A parking lot for ideas raised by "call for ideas" issues. **Nothing here is
committed work** — no item implies a decision, a schedule, or a promise. Items
graduate by becoming their own GitHub issue, at which point they should be
removed from (or struck through in) this file so it never becomes a second
source of truth about what the app actually does.

Each call-for-ideas issue gets its own `##` section. Within a section, ideas are
grouped by theme and carry a rough size (**S** = hours, **M** = a day or two,
**L** = a week or a rethink), the file they would land in, and a flag where they
need a new field on an existing type.

---

## Scaling to lots of timelines (issue #22)

> "beyond tags are there any other good UX ideas to handle lots of timelines
> building up? Come up with lots of same and whacky ideas pls."

### Where it hurts today

Worth being concrete about the current shape before piling on ideas — several
"obvious" suggestions turn out to already exist, and a few problems are sharper
than they look.

- **Everything loads, always.** `reload()` in `src/hooks/useTimelines.ts:12-22`
  calls `adapter.getAllTimelines()` and sorts the whole array most-recently-changed
  first, using `updatedAt ?? createdAt`. There is no paging, no windowing, no
  lazy tail.
- **Everything renders, always.** `TimelineList`
  (`src/components/TimelineList/TimelineList.tsx:107-145`) maps `filtered` to one
  `<li>` per timeline — no virtualization, no pagination, no grouping. At 200
  timelines that is 200 rows and 200 kebab buttons in the DOM.
- **Tag filtering is OR-only, and forgetful.** `filterTags` is component-local
  state (`TimelineList.tsx:26`), so it resets on every remount; the match is
  `t.tags.some(tag => filterTags.includes(tag))` (`TimelineList.tsx:50-52`),
  which means selecting a second tag *widens* the result set. There is no AND,
  no exclusion, and no way to ask for untagged timelines.
- **An active filter is nearly invisible.** With the panel collapsed, the only
  signal is a numeric count badge on the Filter button
  (`TimelineList.tsx:100`) — you can't see *which* tags are on without
  reopening the panel.
- **Search finds entries, not timelines.** `SearchBox`
  (`src/components/SearchBox/SearchBox.tsx:76-105`) loads every entry on focus
  and scores them in JS. The timeline name *is* folded into the score
  (`scoreEntry`, `SearchBox.tsx:30-38`), but every result row is still an
  *entry*: a timeline with no entries can never surface, and because every entry
  in a well-named timeline scores identically, one chatty timeline can fill all
  eight slots (`scored.slice(0, 8)`, `SearchBox.tsx:103`).
- **Badge counts re-scan everything.** `useTodoCounts`
  (`src/hooks/useTodoCounts.ts:14-27`) walks every entry in the store on each
  reload to produce the per-timeline todo badges.
- **The home screen shows five.** The "no timeline selected" state renders
  `timelines.slice(0, 5)` (`src/App.tsx:333-346`) and nothing else.
- **The data model has no vocabulary for scale.** `Timeline`
  (`src/types.ts:1-9`) is `id`, `name`, `createdAt`, `updatedAt?`, `tags`. There
  is no archive, pin, colour, group, folder or manual-order field anywhere in
  `src/`.
- **"Recently changed" isn't "recently visited".** Any entry write bumps
  `updatedAt` via `touchActiveTimeline()` (`src/App.tsx:89-94`), so the sort key
  tracks writes, not attention. Opening a timeline to read it moves nothing.

The short version: the sidebar is a single flat, fully-rendered, recency-sorted
list, and tags are the only narrowing tool — so the ideas below fall into
"show less of it", "give it structure", "sharpen the filter", "stop browsing and
start navigating", "have fewer timelines", "show signal instead of the list",
and "be weird about it".

---

### A. Show less of the list

**A1 — Archive.** An optional `archivedAt?: string` on `Timeline`, with an
**Archive** item added to the sidebar kebab menu
(`TimelineList.tsx:130-136`) routed through the existing `onUpdate` →
`updateTimeline` path. Archived timelines drop out of the main list into a
collapsed **Archived (N)** group at the bottom, and are excluded from `useTags`
so dead tags stop cluttering the filter. *Why it helps:* it is the only idea in
section A that permanently makes the list shorter rather than re-arranging it.
*Lands in:* `src/types.ts`, `src/hooks/useTimelines.ts`, `TimelineList.tsx`,
`src/hooks/useTags.ts`. **M. Needs schema.**

**A2 — Pin / favourite.** Optional `pinned?: boolean`; pinned timelines sort as
a group above everything else in `reload()`. *Why it helps:* the five timelines
you actually live in stop sinking every time you touch an old one. *Lands in:*
`src/types.ts`, `src/hooks/useTimelines.ts:12-22`, `TimelineList.tsx`.
**S–M. Needs schema.**

**A3 — Progressive disclosure.** Render the first ~25 rows and a
**Show all (N)** button. *Why it helps:* the cheapest possible win — no schema,
no data change, no new concepts, and it caps DOM size for free. *Lands in:*
`TimelineList.tsx:107-145`. **S.**

**A4 — Sidebar name type-ahead.** A small input above the `<ul>` that filters
`timelines` by name substring, composed with the existing `filtered` expression
(`TimelineList.tsx:50-52`). *Why it helps:* distinct from the header `SearchBox`,
which searches entry *content* — this is "I know its name, just show me it".
*Lands in:* `TimelineList.tsx`. **S.**

**A5 — Virtualized list.** Render only the visible window. *Why it helps:*
nothing, until the thousands — at 200 rows this is premature. *Caution:* it
fights with sticky group headers (A6, B2) and with in-list expand/collapse, so
decide grouping **before** reaching for it. *Lands in:* `TimelineList.tsx`. **L.**

**A6 — Density control.** Comfortable / compact / ultra-compact row heights,
toggled from the sidebar and persisted to localStorage exactly as `sidebarWidth`
already is (`src/App.tsx:47-65`). *Why it helps:* triples the number of rows on
screen without removing anything. *Lands in:* `TimelineList.module.css`,
`TimelineList.tsx`. **S.**

**A7 — Stale fade.** Dim rows whose `updatedAt` is older than N days so the eye
lands on live work. *Why it helps:* makes the dead two-thirds of a long list
visually recede without hiding it. *Caution:* dimmed row text is still text
meant to be read, so it must stay at 4.5:1 (UI_STANDARDS #3) — fade the
*metadata*, not the name. *Lands in:* `TimelineList.module.css`. **S.**

---

### B. Give the list structure

**B1 — Sort control.** Recent / A–Z / Created / Most todos. Extract the
comparator currently inline in `reload()` (`src/hooks/useTimelines.ts:16-19`)
into an exported `sortTimelines(all, mode)`, and persist the mode to
localStorage. *Why it helps:* recency is the right default and the wrong answer
whenever you're looking for something by name. *Lands in:*
`src/hooks/useTimelines.ts`, `TimelineList.tsx`. **S–M.**

**B2 — Recency group headers.** Today / This week / This month / Older, as
sticky headers in the sidebar. Directly mirrors `buildSections()` in
`src/components/TodoPage/TodoPage.tsx:24-51` and can reuse `toLocalDateString`
and `todayDateString` from `src/utils/dateFormat.ts`. *Why it helps:* turns an
undifferentiated scroll into four scannable chunks, and the pattern already
exists in the app so it will feel native. *Lands in:* `TimelineList.tsx`. **M.**

**B3 — Group by tag.** A toggle that renders collapsible per-tag sections built
from the existing `useTags` output; a multi-tagged timeline appears under each
of its tags. *Why it helps:* it is the "folders" people ask for, without the
data model or the exclusivity. *Lands in:* `TimelineList.tsx`,
`src/hooks/useTags.ts`. **M.**

**B4 — Hierarchical tags by convention.** Treat `/` in a tag as nesting —
`client/acme`, `client/globex` — splitting in `useTags` and rendering an
indented tree in `TagFilter`. *Why it helps:* gives structure at 40 tags with
**no schema change at all**; it's a display convention over the existing
`tags: string[]`. *Lands in:* `src/hooks/useTags.ts`,
`src/components/TagFilter/TagFilter.tsx`. **M.**

**B5 — Saved views / smart lists.** Name a combination of (tags, sort, search)
and pin it to the top of the sidebar — "Active clients", "Needs a nudge".
*Why it helps:* the filter is the expensive part; saving it makes the cost
one-time. *Note:* the IndexedDB `meta` object store already exists
(`src/db/schema.ts:19-22`) if localStorage feels too fragile for this.
*Lands in:* `TimelineList.tsx`, new hook. **M–L.**

**B6 — Per-timeline colour.** Optional `color?: string`, rendered as a left
border stripe on the row. *Why it helps:* colour is the fastest visual scan
there is, and it survives at compact density where text doesn't. *Note:*
UI_STANDARDS #5 rules out emoji as chrome, so a colour swatch (or a chosen
lucide icon) is the compliant way to "give a timeline a face". *Lands in:*
`src/types.ts`, `TimelineList.tsx`. **S–M. Needs schema.**

**B7 — Manual drag ordering.** Optional `order?: number` and drag handles.
*Why it helps:* some people simply know where they put things. *Caution:* this
conflicts with every automatic sort in B1 — you end up needing a "Custom" sort
mode and an answer for where new timelines land. Not a cheap win despite
looking like one. *Lands in:* `src/types.ts`, `TimelineList.tsx`. **M.**

---

### C. Sharper filtering

**C1 — AND mode.** A toggle that switches `.some()` to `.every()` in
`TimelineList.tsx:50-52`, so `client` + `active` narrows instead of widens.
*Why it helps:* at 40 tags, OR-only filtering stops being a filter. *Lands in:*
`TimelineList.tsx`, `TagFilter.tsx`. **S.**

**C2 — Exclusion filter.** A third click on a tag chip cycles
include → exclude → off. *Why it helps:* "everything except `archive`" is often
the query you actually have. *Lands in:* `TagFilter.tsx`, `TimelineList.tsx`. **S.**

**C3 — Persist the filter.** Keep `filterTags` in localStorage (or lift it
beside `showFilter` in `src/App.tsx:43`) so a chosen view survives a reload.
*Why it helps:* today the filter resets and the long list comes straight back.
*Lands in:* `TimelineList.tsx:26`. **S.**

**C4 — Always-visible active-filter bar.** Show the selected chips above the
list when the filter panel is collapsed, instead of only the count badge
(`TimelineList.tsx:100`). *Why it helps:* prevents the "why is my timeline
missing?" confusion that filters cause once the list is too long to eyeball.
*Lands in:* `TimelineList.tsx`. **S.**

**C5 — Untagged bucket.** An explicit **Untagged (N)** chip in `TagFilter`.
*Why it helps:* untagged timelines are currently invisible to every filter, and
they are exactly the ones that need triage. *Lands in:* `TagFilter.tsx`. **S.**

**C6 — Tag usage counts.** Show `(N)` on each chip. *Why it helps:* makes dead
and near-duplicate tags obvious at a glance, and it is computable from the
`timelines` array already being passed to `useTags`. *Lands in:*
`src/hooks/useTags.ts`, `TagFilter.tsx`. **S.**

**C7 — Tag management.** Rename / merge / delete a tag everywhere, from
Settings, iterating timelines through `updateTimeline`. *Why it helps:* tag
sprawl (`client`, `clients`, `Client`) is the specific failure mode that makes
tags stop working at scale — which is arguably what prompted this issue.
*Lands in:* `src/components/Settings/Settings.tsx`. **M.**

---

### D. Navigate instead of browsing

**D1 — Command palette (Cmd/Ctrl-K).** Fuzzy-jump to a timeline by name, plus
commands (New Timeline, Todos, Settings, Export). Reuse `extractText`,
`scoreEntry` and `getSnippet` from `SearchBox.tsx:15-53`, but rank timeline
*names* above entry text. *Why it helps:* the single highest-leverage idea here
— once you can reach any timeline in three keystrokes, the length of the
sidebar stops being a UX problem at all. *Lands in:* new
`src/components/CommandPalette/`, `src/App.tsx`. **M–L.**

**D2 — Timelines section in search results.** Add a name-match group above the
entry results in the `SearchBox` dropdown. *Why it helps:* closes the gap noted
above — an empty or quiet timeline currently cannot be found by name. Nearly
free, and bug-shaped rather than feature-shaped. *Lands in:*
`SearchBox.tsx:141-159`. **S–M.**

**D3 — Group search results by timeline.** Roll up "3 more in Acme Corp" so one
chatty timeline can't consume all eight slots (`SearchBox.tsx:103`). *Why it
helps:* result diversity matters far more at 200 timelines than at 10.
*Lands in:* `SearchBox.tsx`. **S–M.**

**D4 — Search operators.** `tag:client`, `is:todo`, `in:"Acme Corp"`, parsed
out of the query before scoring. *Why it helps:* lets one input do the job of
the filter panel, for people who'd rather type than click. *Lands in:*
`SearchBox.tsx:81-105`. **M.**

**D5 — Recently visited.** Track the last N opened ids in localStorage from
`handleSelectTimeline` (`src/App.tsx:174-177`) and show a **Recent** group.
*Why it helps:* genuinely different from `updatedAt`, which any entry write
bumps (`src/App.tsx:89-94`) — this tracks attention, not edits. *Lands in:*
`src/App.tsx`, `TimelineList.tsx`. **S.**

**D6 — Quick-switch cycling.** A Ctrl-Tab-style ring through the last few
visited timelines, with a held-key overlay. *Why it helps:* most work alternates
between two or three timelines; this makes that free. *Lands in:* `src/App.tsx`.
**M.**

**D7 — Deep-linkable filtered views.** Put filter and sort state in the URL
query string alongside the existing `/timelines/:id` routing. *Why it helps:*
makes a view bookmarkable and shareable, and gives B5 (saved views) somewhere
free to serialize to. *Lands in:* `src/App.tsx`, `TimelineList.tsx`. **M.**

---

### E. Have fewer timelines in the first place

**E1 — Merge two timelines.** Re-point entries with
`adapter.getEntriesForTimeline(from)` → `putEntry({ ...e, timelineId: to })`,
then `removeTimeline(from)`. *Why it helps:* the only idea that directly answers
"too many timelines" by reducing the count. *Lands in:*
`src/hooks/useTimelines.ts`, `TimelineList.tsx` kebab menu. **M.**

**E2 — Split a timeline.** Move a selected date range of entries into a new
timeline. *Why it helps:* the other half of E1 — long-running logs grow a second
topic, and today the only remedy is manual copy-paste. *Lands in:*
`src/components/TimelineView/`. **M.**

**E3 — Move an entry to another timeline.** A per-entry action in `EntryCard`.
*Why it helps:* the fine-grained version of E1, and the piece that makes E5
(inbox) actually workable. *Lands in:* `src/components/EntryCard/`. **S–M.**

**E4 — Near-duplicate detector.** A Settings panel that flags similar names
("Acme" vs "Acme Corp" vs "acme-corp") and offers to merge. *Why it helps:*
duplicates accumulate silently and are the cheapest timelines to delete. Pairs
with E1. *Lands in:* `src/components/Settings/Settings.tsx`. **M.**

**E5 — Inbox pattern.** One always-present quick-capture timeline, triaged later
with E3. *Why it helps:* attacks the root cause — half-formed thoughts currently
spawn throwaway timelines that never get deleted. *Lands in:* `src/App.tsx`,
`TimelineList.tsx`. **M.**

**E6 — Templates.** Create a timeline from a template with preset tags and a
starter entry, extending `handleCreate` (`src/App.tsx:159-172`). *Why it helps:*
reduces naming and tagging drift, and inconsistent tagging is precisely what
makes 200 timelines unfilterable. *Lands in:* `src/App.tsx`,
`TimelineList.tsx`. **M.**

**E7 — Per-timeline export.** `exportData` (`src/utils/exportImport.ts:18-37`)
exports everything. A single-timeline export would make "archive it out of the
app entirely" a real option rather than a scary one. *Lands in:*
`src/utils/exportImport.ts`, `TimelineList.tsx` kebab menu. **S–M.**

---

### F. Surface signal instead of the list

**F1 — Home dashboard.** Replace the "no timeline selected" empty state
(`src/App.tsx:328-362`) with recent activity, a due-now roll-up reusing
`useTodoCounts` and `buildSections`, and a "gone quiet" nudge. *Why it helps:*
the best fix for a long sidebar is rarely needing to read it. Currently that
screen shows five names and two buttons. *Lands in:* `src/App.tsx`, new
`src/components/Home*/`. **M–L.**

**F2 — Last-touched chips.** "3 mo ago" on each row, from `updatedAt`.
*Why it helps:* near-free, and instantly reveals which two-thirds of the list is
dead — the prerequisite for anyone actually using A1. *Lands in:*
`TimelineList.tsx`, `src/utils/dateFormat.ts`. **S.**

**F3 — Entry-count badge.** Alongside the existing todo badge
(`TimelineList.tsx:116-120`). *Why it helps:* distinguishes a real log from an
empty timeline someone created and abandoned. *Caution:* needs a count that
doesn't re-scan all entries per render — see the cost note on `useTodoCounts`.
*Lands in:* `TimelineList.tsx`, new hook. **S.**

**F4 — Activity sparkline.** A tiny per-week entry-count bar strip on each row.
*Why it helps:* shape-of-activity is faster to read than a date, and makes
"ramping up" vs "winding down" visible. *Lands in:* `TimelineList.tsx`. **M.**

**F5 — Weekly digest card.** "You touched 4 of 37 timelines this week — archive
the rest?" *Why it helps:* turns archiving from a chore nobody does into a
one-click prompt. Pairs with A1 and G4. *Lands in:* home screen / `src/App.tsx`.
**M.**

---

### G. Whacky (asked for explicitly)

**G1 — Timeline of timelines.** A zoomed-out swimlane view: each timeline is a
horizontal bar spanning its first to last entry on a shared time axis; click a
bar to open it. *Why it helps:* the most on-brand idea in this document — it
makes "lots of timelines" an *asset* (a picture of your year) instead of a
scrolling problem, and it answers questions a list can't ("what was I doing last
March?"). *Lands in:* new view + route. **L.**

**G2 — Tag constellation.** A force-directed graph where timelines cluster by
shared tags; click a cluster to filter to it. *Why it helps:* reveals the
grouping that already exists in your tags but is invisible in a flat chip row.
*Lands in:* new view. **L.**

**G3 — Spatial desk.** Freely position timeline cards on a 2D canvas, positions
persisted. *Why it helps:* spatial memory beats alphabetical recall for a lot of
people — "it's the one in the bottom-left". *Lands in:* new view,
`src/types.ts`. **L. Needs schema.**

**G4 — Hibernation.** Auto-archive after N untouched days, with a weekly
"these 3 went quiet — keep or archive?" prompt. *Why it helps:* the list stays
short without anyone deciding to tidy it. *Caution:* must be reversible and
never silent. *Lands in:* `src/App.tsx`, Settings. **M. Builds on A1.**

**G5 — Composting.** Stale timelines visibly sink and fade over time, like
sediment. *Why it helps:* an honest, ambient signal of neglect, and it is
genuinely fun. *Caution:* motion must respect `prefers-reduced-motion`
(UI_STANDARDS #6), and faded text must still hit 4.5:1 (#3). *Lands in:*
`TimelineList.module.css`. **M.**

**G6 — Shuffle button.** Opens a random timeline you haven't touched in a while.
*Why it helps:* a serendipity engine for a log app — the neglected timeline you
rediscover is often the one that mattered. Cheap and delightful. *Lands in:*
`TimelineList.tsx`. **S.**

**G7 — On this day.** Surface entries from a year ago today on the home screen.
*Why it helps:* gives old timelines a reason to exist rather than a reason to be
deleted, which is the nicer answer to "too many". *Lands in:* home screen. **M.**

**G8 — Local auto-tag suggestions.** Suggest existing tags for a timeline by
term overlap between its entry text and tag names — computed entirely locally,
no network (the app is local-first with no server by design, `README.md:3-7`).
*Why it helps:* untagged timelines are the ones that break tag-based filtering;
this lowers the cost of tagging to one click. *Lands in:* `TimelineView`,
`src/utils/`. **M.**

**G9 — Auto-clustering.** "These 5 timelines share a lot of vocabulary — tag
them as a group?" *Why it helps:* finds the structure you never got around to
declaring. *Caution:* useless without G10 to apply the suggestion in bulk.
*Lands in:* Settings. **L.**

**G10 — Bulk multi-select.** A checkbox mode in the sidebar for tag / archive /
delete in one sweep. *Why it helps:* boring, and the thing you'll actually need
the moment G9 proposes 40 changes — or the moment anyone tries to clean up 200
timelines by hand. *Lands in:* `TimelineList.tsx`. **M.**

**G11 — Focus mode.** Pick 3 timelines for this week; everything else collapses
behind a "show everything" toggle. *Why it helps:* a self-imposed constraint
beats any sorting algorithm, and it's reversible in one click. *Lands in:*
`TimelineList.tsx`. **M.**

**G12 — Sidebar-as-tag-cloud.** Above some count, stop listing timelines
entirely and show only tags, sized by usage; drill in on click. *Why it helps:*
accepts that a 300-item list is not a navigable object and replaces it with one
that is. *Lands in:* `TimelineList.tsx`. **M.**

---

### Considered and not recommended

- **Nested timelines / sub-timelines.** The user guide already actively steers
  people the other way — "use **tags** instead of splitting hairs … rather than
  nesting them" (`docs/guide/timelines.md:35-43`). Reversing that is a product
  U-turn, not a UX tweak. B3 (group by tag) and B4 (hierarchical tag names)
  deliver most of the benefit without the data model or the "which folder did I
  put it in?" problem. Revisit only as a deliberate product decision.
- **A server-side or hosted full-text index.** Would fix search cost at scale,
  and breaks the no-account, no-server premise the app is built on
  (`README.md:3-7`). If entry-scanning search becomes genuinely slow, the answer
  is a local index (IndexedDB, the existing `meta` store), not a backend.
- **Converting the mobile drawer to partial width** to make room for a tree or
  a two-pane browser. Explicitly forbidden by UI_STANDARDS #7 — the full-width
  drawer is a deliberate trade in favour of search. Any sidebar idea here has to
  work at full width on mobile.

---

### Constraints any of these must respect

**UI.** From `UI_STANDARDS.md`: tokens rather than new hard-coded hex (#1);
a visible focus state on every new control (#2); 4.5:1 contrast for any dimmed,
stale or muted text meant to be read (#3) — relevant to A7, F2 and G5; no
hover-only affordances, since the kebab-menu pattern is the house solution (#4);
lucide icons, never emoji, as chrome (#5) — relevant to B6; respect
`prefers-reduced-motion` (#6) — relevant to G5; and the mobile drawer stays
full-width (#7), so every sidebar idea must work both in the resizable desktop
panel and full-width on mobile (`src/App.tsx:237-296`).

**Data.** Any new `Timeline` field must be **optional**, exactly like
`updatedAt?` (`src/types.ts:1-9`), so that: version-1 exports still import
(`ExportData`, `src/types.ts:30-35`; `exportData`,
`src/utils/exportImport.ts:18-37`); `mergeForeignState` keeps working unchanged,
including its last-`updatedAt`-wins rule for timelines
(`src/storage/merge.ts:34-50`); and `FakeAdapter`
(`src/test-utils/fakeAdapter.ts`) plus both real adapters (`idbAdapter`,
`opfsAdapter`) round-trip it without a migration. Note also that
`updateTimeline` stamps `updatedAt` on every write
(`src/hooks/useTimelines.ts:38-41`) — so archiving or pinning a timeline will
also mark it as "recently changed" unless that is handled deliberately.

**Docs.** Anything shipped from this list needs a pass over
`docs/guide/timelines.md` and `docs/guide/tags-and-search.md`, both of which
currently describe the sidebar and tag filter as the whole story.

---

### If you only do three

1. **A3 + A4** — progressive disclosure plus a sidebar name filter. Hours of
   work, no schema change, no new concepts, and it removes the immediate
   scrolling pain.
2. **A1 — archive.** The only idea that permanently *shrinks* the list instead
   of re-arranging it. Everything else in section A is compensation for a list
   that is too long; this makes it shorter.
3. **D1 — command palette.** Makes list length irrelevant for navigation, which
   is the actual reason a long sidebar hurts.

Worth folding in for free: **D2** (timelines in search results) is bug-shaped
rather than feature-shaped — a timeline with no matching entry text cannot
currently be found by name — and belongs in whichever search work happens first.

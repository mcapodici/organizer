# Sync & Conflict Handling — Architectural Review

Issue #20: *"review sync code and if it is the right fit now that we only use
local storage and not arbitrary folders. we sort of need to handle concurrent
changes from other tabs."*

This is the review that issue asked for, plus the direction that was taken from
it. Line references point at the code **as it was before this change**; the
recommendation at the end is what landed.

---

## Summary

The conflict machinery was built for a different problem. Commit `07f66cb`
("syncthing merge support and automerge") added it when a workspace was an
arbitrary folder that an external sync tool could rewrite underneath the app.
That world is gone: Organizer now stores everything in OPFS (Chrome/Edge/Safari)
or IndexedDB (Firefox and friends), on one device, and `docs/guide/storage-and-backup.md`
tells users outright that data is *not* synced to other machines.

What remains is a much smaller problem — **two tabs of the same browser profile
over one shared store** — and the existing design is a poor fit for it in three
ways:

1. It solves for divergent *replicas*. Two tabs are not replicas; with IndexedDB
   they are literally the same database, and with OPFS the same file tree. The
   other tab's write is already durable and already visible. There is no
   conflict to resolve — only **staleness** in this tab's view.
2. It is **actively harmful**, not merely redundant: the global freeze turns a
   benign concurrent edit into a silently dropped write (F4).
3. The one thing that genuinely matters for a local app — a second tab's changes
   showing up — works only as an accidental side effect of the conflict path
   (F5), and never fires in the most common case (F6, and a tab left in the
   background).

Ten findings follow, then the recommendation.

---

## Findings

### F1 — `mergeConflictFiles` is Syncthing-only and is never called

`StorageAdapter.mergeConflictFiles` (`src/storage/interface.ts:32`) exists to
scan for external `.sync-conflict-*` files. Neither backing store can produce
one: `IdbAdapter.mergeConflictFiles` (`idbAdapter.ts:67`) and
`OpfsAdapter.mergeConflictFiles` (`opfsAdapter.ts:191`) both hardcode
`{ importedCount: 0, conflictCount: 0 }`, and `StorageContext.runMerge` carries
a comment saying exactly that (`StorageContext.tsx:122-123`) — it never calls it
at all. Despite that it is declared on the interface, implemented twice,
forwarded through `withErrorCapture` (`StorageContext.tsx:53`), and stubbed in
`FakeAdapter` (`fakeAdapter.ts:59`). Four implementations of a method with zero
callers and no possible non-zero return.

### F2 — `mergeForeignState` is dead production code

`mergeForeignState` and `ForeignMergeOutcome` (`src/storage/merge.ts:34-69`)
have no production callers. The only callers are six cases in `merge.test.ts:54-102`.
Tested dead code is worse than untested dead code: the tests make it read as
live behaviour to the next person.

### F3 — A single global `saveId` conflates "another tab wrote" with "conflict"

Both adapters keep one `lastKnownSaveId` and compare it against a single
store-wide token (`idbAdapter.ts:29-39`, `opfsAdapter.ts:140-150`). Any write by
tab B — a note in a completely different timeline, a `updatedAt` touch, an
attachment blob — bumps that token, so tab A's `hasConflict()` returns true and
`frozen` latches to `true` until a merge runs.

But with IndexedDB both tabs share one database, and with OPFS one file tree.
B's write is *already* in the store A reads from. Nothing diverged. The
protocol's unit of concurrency (the whole store) is about as coarse as it can
get, on a problem whose natural unit is one note.

### F4 — The freeze silently loses writes

This is the serious one. The chain:

- `guardedWrite` throws `ConflictError` on every write once frozen
  (`idbAdapter.ts:71-77`, `opfsAdapter.ts:196-202`).
- `withErrorCapture`'s `onConflict` is an empty callback for both phases
  (`StorageContext.tsx:134` and `:137` — `() => { /* poll auto-merges */ }`) and
  then **rethrows**.
- `EntryComposer.handleSave` (`EntryComposer.tsx:155`) wraps `onSave` in
  `try/finally` with no `catch`. The rejection is unhandled: the user clicks
  Save, the editor keeps its content, and **nothing tells them the save failed**.
- `App.touchActiveTimeline` (`App.tsx:92-94`) calls `void updateTimeline(...)`,
  swallowing the rejection entirely.

Two more structural consequences of the same freeze:

- `useTimelines.removeTimeline` is a three-phase sequence with no transaction —
  `deleteBlob`×N → `deleteEntriesForTimeline` → `deleteTimeline`. A freeze
  partway leaves a half-deleted timeline.
- `EntryComposer.handleSave` writes attachment blobs *before* the entry, so a
  freeze between the two orphans the blobs.

A mechanism whose entire purpose is "don't lose data" loses data.

### F5 — Nothing refreshes the UI on a cross-tab write except the conflict path

`useEntries.reload`, `useTimelines.reload` and `useTodoCounts.reloadTodoCounts`
are all `useCallback`s keyed on `adapter`. The provider's `safeAdapter` `useMemo`
lists `mergeNonce` in its deps (`StorageContext.tsx:132-141`), so bumping the
nonce mints a new adapter object, which cascades into every hook's reload. That
is the *only* thing that pulls another tab's changes into the view.

It is load-bearing and entirely accidental. It fires only after a freeze has
been detected, and it always emits a toast. Nothing at all listens for `focus`
or `visibilitychange` — a tab left open in the background and returned to is the
single most common real scenario, and it is not handled.

### F6 — `OpfsAdapter` serves every read from a cache invalidated only by the conflict path

`OpfsAdapter` populates `this.timelines` / `this.entries` once in `init()`
(`opfsAdapter.ts:122-133`) and rebuilds them only inside `mergeFromDisk`
(`opfsAdapter.ts:152-189`). `getAllTimelines`, `getAllEntries`, and
`getEntriesForTimeline` all read that in-memory index, never the file tree.

OPFS is the *primary* backend on Chrome, Edge and Safari. So on most browsers
the app renders a snapshot of the store taken at boot, whose only invalidation
route is the conflict path from F5.

### F7 — The "Merged N notes" toast branch is unreachable

`opfsAdapter.ts:188` returns
`importedCount: outcome.entries.length - this.entries.size` — but `this.entries`
was rebuilt from `outcome.entries` twenty lines earlier (`:171-174`). The
difference is always 0. `IdbAdapter.mergeFromDisk` returns a hardcoded `0` or
`1`. So `Toast.describe`'s `t.imported > 0` branch (`Toast.tsx:8-16`) is
effectively dead, and the user only ever sees "Loaded the latest changes from
another device" — on a single-device app.

### F8 — `guardedWrite` is TOCTOU

`check → write → bump` is not atomic in either adapter. Two writers in the same
tick both pass `hasConflict()`, both write, and both bump; the loser's
`lastKnownSaveId` no longer matches the store, producing a **spurious freeze**
on its next write. The guard manufactures the condition it exists to detect.

### F9 — The 2s poll is pure overhead

`setInterval(..., 2000)` (`StorageContext.tsx:143-148`) runs for the life of the
tab, including backgrounded ones, and every tick does an OPFS file read or an
IndexedDB `meta` get. That is the cost of polling for an event that a
`BroadcastChannel` message delivers for free, at the moment it happens.

### F10 — Leftovers from the removed multi-backend design

- `StorageMode` (`StorageContext.tsx:8`) is exported and imported nowhere.
- `lastSaved` lives on the `Phase` union but only on the `readyIdb` variant
  (`StorageContext.tsx:13`, read at `:162`). `markSaved()` writes
  `localStorage.lastSaved` on *every* backend (`:100-104`), but on OPFS —
  i.e. Chrome, Edge, Safari — the context value is always `null`, so
  `Settings.tsx:56` never renders the "Last backup export" date.
- The writeError modal's Retry rebuilds `IdbAdapter` with `lastSaved: null`
  (`StorageContext.tsx:189`), dropping the timestamp even where it did work.
- Two comment blocks (`StorageContext.tsx:93-98`) describe methods that no
  longer exist.
- `Settings.handleReset` (`Settings.tsx:39-42`) — the destructive-red "Clear
  everything" button behind a confirm modal — closes the modal and navigates to
  `/`. **It deletes nothing.** `docs/guide/storage-and-backup.md:20-21` tells
  users it wipes their data.

---

## Recommendation (implemented)

Replace the store-wide freeze protocol with two much smaller mechanisms, and
delete the Syncthing-era code.

**1. Cross-tab refresh, event-driven.** A `BroadcastChannel` wrapper
(`src/storage/changeChannel.ts`) posts after every successful write and every
other tab responds by calling `adapter.refresh()` and bumping `storeVersion` —
which reuses the existing adapter-identity mechanism from F5, now with a correct
trigger instead of an accidental one. `visibilitychange` and `window.focus`
listeners cover the catch-up case a message can miss (a suspended or bfcached
tab), which is also the case the poll handled worst. `OpfsAdapter.refresh()`
re-runs `scanWorkspace`, which is the fix for F6 — until now its cache had
nothing to invalidate it. `IdbAdapter.refresh()` is a documented no-op because
IndexedDB reads always hit the live store.

**2. Per-record optimistic concurrency.** `Entry` gains an optional opaque
`rev: string`, regenerated on every write. `src/storage/saveEntry.ts` reads the
stored entry first; if both sides carry a `rev` and they differ, the stored
version is preserved under a fresh id with a `markMergedCopy` banner before the
caller's version is written. This keeps the one genuinely valuable behaviour of
the old design — *never silently clobber a note another tab changed* — scoped to
the single record being saved instead of freezing the entire store. `rev` is
optional, so existing data needs no migration and no schema bump; detection
fails open (today's last-write-wins) until both sides carry one, which happens
after one write.

Deleted: `ConflictError`, `hasConflict`, `mergeFromDisk`, `mergeConflictFiles`,
`mergeForeignState`, `mergeDiskState`, `saveId` in both adapters, the 2s poll,
`registerActiveEdit`, and `StorageMode` — roughly 250 lines. `markMergedCopy`
survives; it is the useful half.

Also fixed, as leftovers of the same rework: `Settings.handleReset` now actually
clears the store (via a `clearAllData` helper extracted from `importData`), and
`lastSaved` moved off the `Phase` union so the backup date renders on OPFS too.

The refresh is now **silent**. A toast fires only when both versions of a note
were kept — the one case where the user ends up with a note they did not create.

---

## Known limits — deliberately not fixed here

These are real and should be stated rather than implied away.

- **`saveEntry` is still TOCTOU, narrowly.** It reads the stored `rev` and then
  writes; two tabs saving the same note inside the same event-loop tick can
  still last-write-win. OPFS cannot do a cross-file atomic transaction, so this
  cannot be closed by putting the read and write in one IDB transaction without
  forking the two adapters. It is strictly better than the old behaviour (which
  lost writes across a 2s window, for *unrelated* records) and acceptable for a
  single-user local app.
- **`OpfsAdapter`'s index is still a cache.** A tab that misses a channel
  message and is never focused again stays stale. Reading through to OPFS on
  every call would be correct and far slower. `refresh()` on focus/visibility
  covers the realistic case.
- **Multi-call write sequences are still not transactional.**
  `useTimelines.removeTimeline` (three phases) and `EntryComposer.handleSave`
  (blobs before entry) can still orphan blobs or half-delete a timeline if a
  write fails midway. Removing the freeze removes the only trigger that fired in
  normal use, but the structural gap remains. Worth a follow-up issue.
- **Every write posts on the channel.** A bulk `importData` of a large export
  posts once per record, and each message costs every other tab a `refresh()`.
  A trailing debounce (~100ms) on the post side is the fix if this ever shows up
  in practice; it was not added pre-emptively.
- **The two adapters were kept.** `IdbAdapter` is now ~50 lines of passthrough
  and Firefox has had OPFS since 111, so it is close to vestigial — but existing
  Firefox users have live data in IndexedDB, and collapsing the two means
  writing and testing a one-way migration that risks the only copy of someone's
  notes. Separate issue.

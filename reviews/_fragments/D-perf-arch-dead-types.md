Review complete. Fragment written to `reviews/_fragments/D-perf-arch-dead-types.md`. No source files were modified.

# Fragment D — Performance, Architecture, Dead Code, Type Safety

Scope: whole `src/` tree plus `vite.config.ts`, `tsconfig*.json`, `eslint.config.js`. Read-only; the only file written was the fragment.

## 1) PERFORMANCE
- **[High] `EntryCard` rebuilds full TipTap HTML every render** — `EntryCard.tsx:34-46` calls `generateHTML` (full ProseMirror schema) in the render body with no `useMemo`, and `TimelineView.tsx:151-162` maps every entry with no `React.memo`. The 2s merge poll re-renders the whole tree.
- **[High] Timeline is not virtualized** — `TimelineView.tsx:150-163` and `TimelineList.tsx:107-145` render full `.map()`s; `grep` for `react-window`/`virtual`/`tanstack` finds nothing. Every attachment also opens a blob + object URL on mount.
- **[Medium] Context values unmemoized** — `StorageContext.tsx:165` and `UndoContext.tsx:70` pass fresh object literals; `markSaved` isn't `useCallback`.
- **[Medium] `getAllEntries()` full scans** on todo counts (`useTodoCounts.ts`), TodoPage, and SearchBox (rescored on every keystroke).
- **[Low] TipTap loaded eagerly, no `manualChunks`.**
- Looks OK: lucide named imports tree-shake, `useTags` memoized, PWA cache strategy sound, object URLs revoked.

## 2) ARCHITECTURE
- **[High] `App.tsx` is a god component** (367 lines: string-match routing, resize drag, welcome seeding, undo wiring, responsive state).
- **[Medium] Duplicated `EditTagsModal`** (TimelineList + TimelineView), `capitalize`, and `extractText`.
- **[Medium] Dead interface surface** — `mergeConflictFiles` and `duplicatedEntryId` are never consumed at runtime (proven by grep).
- Looks OK: adapter abstraction, phase state machine, DB layer separation, undo isolation.

## 3) DEAD CODE (all proven with grep)
- **[Medium] `AppBanner` component + CSS unused** (only self-references).
- **[Low] `showNudge = false`** makes the export-nudge branch unreachable.
- **[Low] `zod` dependency unused** anywhere.
- **[Low] OPFS `importedCount` is structurally always 0** (`opfsAdapter.ts:188`).

## 4) TYPE SAFETY
- **[High] `strict` mode is OFF** — no `strict`/`extends` in any tsconfig, so `strictNullChecks` is disabled and every `!` (`this.root!`, `dueDate!`) is unverified.
- **[Medium] Untrusted `JSON.parse(...) as ExportData`** on import with no validation (`exportImport.ts:41`) — `zod` is installed but unused.
- **[Low] Pervasive `!` / `as` casts** standing in for null checks.
- Looks OK: **zero `any`**, clean `types.ts`/`global.d.ts`, ESLint enforces no-explicit-any with `--max-warnings 0`.

**Top 3 priorities:** (1) enable TS `strict`; (2) memoize/virtualize the timeline rendering; (3) remove dead surface (`AppBanner`, `showNudge`, `zod`, `mergeConflictFiles`).
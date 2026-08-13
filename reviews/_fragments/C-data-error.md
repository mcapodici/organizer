Review complete. Fragment written to `reviews/_fragments/C-data-error.md`. Here is the full result:

# C — Data Integrity & Error Handling Review

Scope: `src/storage/` (interface, idbAdapter, opfsAdapter, merge + tests), `src/utils/exportImport.ts`, `src/utils/todoUndo.ts`, `src/context/StorageContext.tsx`, `src/context/UndoContext.tsx`, `src/hooks/*`, plus the supporting `src/db/*` layer and `src/components/Settings/Settings.tsx` (the sole import caller). Every finding was read from source with real line numbers.

---

## Angle 1 — Data Integrity & Persistence

### [Severity: High] Corrupt OPFS entry/timeline file wedges the whole app permanently
- Evidence: `src/storage/opfsAdapter.ts:161-162` and `:236-238` do unguarded `JSON.parse` on stored text; `scanWorkspace` (`:87-92`) only catches `readText` failures, not parse failures.
- Why it matters: one readable-but-invalid JSON file makes `getAllEntries()` reject → `useEntries.reload` throws → timeline never renders. If the poll hits `mergeFromDisk`, the parse rejects into `runMerge`'s empty catch (`StorageContext.tsx:128`) and retries every 2s forever while `frozen`, rejecting all writes. Silent and permanent.
- Suggested direction: parse defensively at scan time, quarantine bad files, and surface a count.

### [Severity: High] OPFS `importedCount` is always ~0
- Evidence: `opfsAdapter.ts:167-188` — `this.entries` is rebuilt from `outcome.entries` before `importedCount: outcome.entries.length - this.entries.size` is computed, so it is always 0.
- Suggested direction: return an explicit count from `mergeDiskState` (as `mergeForeignState` already does).

### [Severity: Medium] IDB merge count is a constant, not a real count
- Evidence: `idbAdapter.ts:59,63` return `1`/`0`. The toast number means different things across backends.

### [Severity: Medium] Import ignores `version`; blobs always overwrite
- Evidence: `exportImport.ts:41` never inspects `data.version`; `:67-68` overwrites blobs even in merge mode where entries are skipped.

### [Severity: Medium] `replace` import is destructive and non-atomic
- Evidence: `exportImport.ts:43-52` wipes, then `:61-69` writes; no transaction/rollback; `Settings.tsx:29-36` only resets UI flags. A malformed file or quota mid-import leaves a half-empty workspace with no message.

### [Severity: Medium] Import crashes on a missing `timelines`/`entries` array
- Evidence: `exportImport.ts:61-66` iterate unguarded; only `blobs` has `|| {}` (`:67`).

### [Severity: Low] `mergeForeignState` is dead in production
- Evidence: grep across `src/` and `docs/` finds only the definition (`merge.ts:34`) and its tests; both `mergeConflictFiles` are zero stubs.

### [Severity: Low] Timestamp ordering assumes one canonical ISO form
- Evidence: `useEntries.ts:15`, `useTimelines.ts:19`, `merge.ts:19-23` all use string compare — breaks on mixed offsets/precision from imported data.

### Looks OK (Data Integrity)
- `mergeDiskState` draft-vs-disk logic, `revertTodoFields` field-scoping, UUID id generation, OPFS entry-move deletion, additive IDB migrations, and stable-sort tie handling are all correct and tested.

---

## Angle 2 — Error Handling & Resilience

### [Severity: High] IDB write failures (incl. QuotaExceededError) are swallowed
- Evidence: `StorageContext.tsx:136-138` gives IDB a no-op `onError`; `withErrorCapture` (`:29-36`) still rethrows, so the rejection bubbles to an uncaught `onClick` with no UI — a silent lost save.

### [Severity: High] "Unable to save" modal promises auto-retry that never happens
- Evidence: `StorageContext.tsx:177-179` copy vs the poll (`:143-148`) that only merges/reads and never replays the failed write. Misleading for quota.

### [Severity: Medium] `runMerge` swallows every error, hiding a stuck adapter
- Evidence: `StorageContext.tsx:113-129` catch-all treats permanent failure as transient, looping silently while `frozen`.

### [Severity: Medium] `guardedWrite` is not atomic (op vs saveId bump)
- Evidence: `opfsAdapter.ts:196-202`, `idbAdapter.ts:71-77` — data can commit while `writeSaveId` fails, drifting data from its change marker.

### [Severity: Medium] Import mid-flight can hit ConflictError and partially apply
- Evidence: every import write passes `guardedWrite`→`hasConflict` (`opfsAdapter.ts:197`, `idbAdapter.ts:72`); `importData` loop has no conflict handling; in replace mode the wipe already happened.

### [Severity: Low] Export/import blob codecs can OOM/throw with no handling
- Evidence: `exportImport.ts:4-16,18-37` — full in-memory base64 + pretty-printed JSON, `atob` throws on bad input, no guards.

### [Severity: Low] `URL.revokeObjectURL` fires synchronously after `a.click()`
- Evidence: `exportImport.ts:31-36` — can cancel the download in some browsers.

### Looks OK (Error Handling)
- "Already gone" deletes are safe no-ops; the conflict-freeze design is coherent and tested; `mergeInFlightRef` prevents overlapping polls; `UndoContext` clears before running undo and cleans timers; `revertTodoFields` handles deleted entries; OPFS blob getters degrade gracefully.

---

## Top 3 priorities for this fragment
1. **Corrupt OPFS file wedges the app permanently** (High) — defensive parse + quarantine.
2. **IDB write/quota failures swallowed** (High) — surface and classify storage errors; fix misleading retry copy.
3. **Non-atomic destructive `replace` import** (Medium→High) — validate fully before deleting; report failures.
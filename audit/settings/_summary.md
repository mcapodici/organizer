Audit complete. No source files were modified (only `audit/` docs+media and the transient `.playwright-cli/` tool cache). Both browser sessions are closed.

## Settings Area — UX/UI Audit Results

I booted the app at `http://localhost:5174/app/`, seeded the standard fixture data via the `seedData` harness (forcing IndexedDB, plus a second OPFS session to check backend-specific behavior), and drove real flows with a named `settings-audit` playwright-cli session. Six genuine, reproducible issues were found and documented under `audit/settings/`, each with `finding.md`, `issue.webm`, annotated `issue-1.png`, and an `improved.webm`/`improved-mockup.png` (throwaway in-page tweaks, discarded on reload).

| Title | Type | Severity | Folder | Effort |
|-------|------|----------|--------|--------|
| "Clear all data" deletes nothing — destructive action is a no-op | Bug | **Critical** | `audit/settings/01-clear-data-noop/` | M |
| Importing malformed JSON fails silently — no error shown | Bug | High | `audit/settings/02-silent-import-failure/` | S |
| Modals don't manage focus — no trap, keyboard escapes to background | Bug | High | `audit/settings/04-modal-focus-trap/` | M |
| Export gives no confirmation; its only feedback is dead on OPFS | UX | Medium | `audit/settings/03-export-no-feedback/` | S |
| App logo 404s — hard-coded `/logo.svg` ignores `/app/` base path | Bug | Medium | `audit/settings/05-logo-404-basepath/` | S |
| "Replace all data" import is one-click destructive with no warning | UX | Medium | `audit/settings/06-replace-import-no-warning/` | S |

### Headline finding (Critical)
`handleReset()` in `src/components/Settings/Settings.tsx` (lines 39-42) only closes the modal and `navigate('/')` — it **never calls the storage adapter**. Verified: 10 timelines before "Clear everything" → 10 after. The modal promises permanent deletion but nothing is deleted, a real privacy/safety hazard on shared devices.

### Other confirmed bugs
- **Silent import failure**: `importData` does `JSON.parse` with no error handling and `handleImport` has a `try/finally` with no `catch`; bad JSON throws only to the console (`SyntaxError … at importData (exportImport.ts:38)`) while the modal closes as if it succeeded.
- **No modal focus management**: `Modal.tsx` only wires Escape. Focus never enters the dialog and Tab escapes to the background nav behind the overlay (WCAG 2.4.3/2.1.2), worst on the destructive dialogs.
- **Logo 404**: code hard-codes `/logo.svg` but Vite `base` is `/app/`; `curl` confirms `/logo.svg`=404, `/app/logo.svg`=200. `<img>` reports `naturalWidth:0`.

### UX gaps
- **Export feedback**: no toast; the "Last backup export" date is the only feedback and `StorageContext` forces `lastSaved=null` on OPFS (the default backend), so most users get zero confirmation.
- **Replace-all-data import**: destructive red button is first/primary with no warning copy and no second confirm, inconsistent with the careful Clear-all-data flow.

### Verified-good (no findings)
- Export/import round-trip works (export → wipe → replace restored all 5 timelines); bad JSON parses before the replace-deletions so data survives (incidental).
- Global `:focus-visible` and `prefers-reduced-motion` guards (UI_STANDARDS #2/#6) are present.
- The Backend row uses a lucide `Globe` icon, not emoji (UI_STANDARDS #5).

Full details, repro steps, and fix pointers are in each `finding.md`; the overview table is in `audit/settings/_summary.md`.
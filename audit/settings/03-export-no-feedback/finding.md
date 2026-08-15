# Export gives no on-screen confirmation, and its only feedback is dead on OPFS

- Area: settings
- Type: UX
- Severity: Medium
- Screen/route: `#/settings` → Backup card → "Export" button. Components `src/components/Settings/Settings.tsx` (`handleExport`, lines 21-24; Backend row lines 51-63) and `src/context/StorageContext.tsx` (`markSaved` lines 100-104; `lastSaved` line 162).
- Repro:
  1. Boot the app in a normal Chromium/Safari/Edge browser (OPFS is auto-selected — see `StorageContext` boot, lines 79-91).
  2. Open `#/settings` and click **Export**.
  3. A file downloads, but watch the page for any confirmation.
- Observed: No toast, banner, or inline message appears anywhere on the page after an export — the only signal is the browser's own download chrome. The app *does* record a backup timestamp (`markSaved()` writes `localStorage.lastSaved`), and the Storage card is meant to show "· Last backup export: <date>". But that line is gated on `lastSaved !== null`, and `StorageContext` forces `lastSaved = null` whenever the backend is OPFS (line 162: `phase.tag === 'readyIdb' ? phase.lastSaved : null`). So on OPFS — the **default** for Chrome/Edge/Safari — the backup date never appears no matter how many times you export. Verified in-browser: after Export, `localStorage.lastSaved` was set to `2026-08-15T00:42:35Z` yet the Backend row still read only "App storage on this device". See ./issue.webm and ./issue-1.png.
- Expected / proposed: (1) Show an explicit success confirmation after export (a toast such as "✓ Exported timelines-2026-08-15.json"), reusing the existing `ToastStack`. (2) Make the "Last backup export" date work regardless of backend — track `lastSaved` for OPFS too (it is already written to localStorage), so the backup-reminder feedback is not silently disabled for most users.
- Improved demo: ./improved.webm and ./improved-mockup.png (throwaway tweak: a capture-phase listener on the Export button that shows a bottom-centered "✓ Exported timelines-2026-08-15.json" toast for ~2.6s. Discarded on reload.)
- Fix pointer: `src/components/Settings/Settings.tsx` `handleExport` — emit a success toast. `src/context/StorageContext.tsx` line 162 / `markSaved` — expose `lastSaved` for the OPFS phase too (read from localStorage on boot for OPFS as it already does for IDB on line 87).
- Effort: S

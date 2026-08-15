# "Replace all data" import is one-click destructive with no warning

- Area: settings
- Type: UX
- Severity: Medium
- Screen/route: `#/settings` → Backup card → Import → "Import Data" modal, "Replace all data" button. Component `src/components/Settings/Settings.tsx` (import modal lines 133-153; `handleImport('replace')` lines 26-37) → `src/utils/exportImport.ts` `importData` replace branch (lines 43-52).
- Repro:
  1. Seed the app (5 timelines) and open `#/settings`.
  2. Click **Import** and choose any valid export file.
  3. In the modal, read the copy: "Import <file>" / "Choose how to import:" — then note the buttons.
  4. Click **Replace all data**.
- Observed: The modal presents **Replace all data** (red/danger) as the *first* button, ahead of the safer "Merge (skip duplicates)". Clicking it immediately deletes every existing timeline, entry, and blob and replaces them — with **no warning text and no secondary confirmation**. The modal body only says "Choose how to import:"; nothing tells the user that Replace is destructive or suggests exporting first. This is inconsistent with the "Clear all data" flow, which gets a full warning ("This will delete all… permanently. Export your data first…"). A user who reflexively clicks the primary/leftmost button can irreversibly wipe their data. See ./issue.webm and ./issue-1.png. (Data loss confirmed separately: replace wipes all stores before importing.)
- Expected / proposed: Add an explicit inline warning in the import modal that "Replace all data" permanently deletes current data, and either (a) require a second confirmation for replace, or (b) make **Merge** the visually primary/default action and de-emphasize Replace. Match the care already taken in the Clear-all-data modal.
- Improved demo: ./improved.webm and ./improved-mockup.png (throwaway tweak: injected a red warning banner under "Choose how to import:" reading that Replace permanently deletes current data, and reordered the buttons so the safe "Merge" comes first. Discarded on reload.)
- Fix pointer: `src/components/Settings/Settings.tsx` import modal (lines 133-153) — add warning copy, reorder actions (Merge first), and/or gate `handleImport('replace')` behind a confirm step.
- Effort: S

# Storage & backup

Organizer is **local-first**: there's no account and no server. Your data never
leaves your device unless you export it. This page explains where it's kept and
how to keep it safe.

## Where your data lives

Organizer stores your timelines automatically on this device — there's no setup
step and nothing to choose. It uses the **Origin Private File System (OPFS)**
when your browser supports it, falling back to **IndexedDB** otherwise. Either
way:

- ✅ Nothing to set up — Organizer just works the moment you open it.
- ✅ Works fully offline.
- ⚠️ Tied to this browser on this device. It is **not** synced to other
  machines, and clearing your browser's site data will remove it. Keep
  [exports](#backing-up-with-export-import) as your safety net.

**Settings → Backend** shows "App storage on this device," and **Clear all
data** wipes it if you ever need a clean slate.

### Using Organizer in more than one tab

All your tabs share the same data, so a change you make in one appears in the
others within a moment — and whenever you switch back to a tab you left open,
it catches up before you start typing.

If you happen to edit the **same note** in two tabs without reloading, nothing
is thrown away: the note keeps the version you saved last, and the other version
is kept alongside it as a separate note marked *"Merged copy from another
device"* so you can compare the two and delete whichever you don't want.

## Backing up with Export / Import

**Export** is how you make a portable backup.

### Export

**Settings → Backup → Export** downloads **all** your data — timelines, entries,
and attachments — as a single JSON file. Keep it somewhere safe.

Organizer shows a gentle **"No backup · Export now"** nudge in the header if you
haven't exported in over a week.

### Import

**Settings → Backup → Import**, choose a previously exported `.json` file, then
pick how to bring it in:

- **Replace all data** — wipes current data and restores the file exactly. Use
  when recovering a backup or moving to a new device.
- **Merge (skip duplicates)** — adds anything from the file that you don't
  already have, leaving your existing data untouched. Use to combine two sets of
  timelines.

::: warning
**Replace all data** is destructive — it discards whatever is currently stored.
If in doubt, export your current data first, then import.
:::

## Moving to a new device

1. On the old device: **Settings → Backup → Export**.
2. Transfer the JSON file to the new device.
3. On the new device: open Organizer, then
   **Settings → Backup → Import → Replace all data**.

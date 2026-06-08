# Storage & backup

Organizer is **local-first**: there's no account and no server. Your data never
leaves your device unless you export it. This page explains where it's kept, how
to switch, and how to keep it safe.

## Two storage modes

When you first open Organizer you choose one of these. You can change later in
**Settings → Storage** without losing data.

### Browser storage

Your timelines are saved inside this browser (using IndexedDB) on this device.

- ✅ Fastest to start — nothing to set up.
- ✅ Works fully offline.
- ⚠️ Tied to this browser on this device. It is **not** synced to other
  machines, and clearing your browser's site data will remove it. Keep
  [exports](#backing-up-with-export-import) as your safety net.

### Folder on your computer

Organizer reads and writes your data in a folder you pick (using your browser's
File System Access support).

- ✅ Your data lives as real files you can see, back up, and sync with your own
  tools (Dropbox, OneDrive, a USB stick, git…).
- ✅ Easy to keep multiple separate **workspaces** — just point at different
  folders.
- ⚠️ Requires a browser that supports folder access (most desktop
  Chromium-based browsers).

When you're in folder mode, your current workspace is shown under
**Settings → Storage** — open Settings to switch to another folder or workspace.

## Switching storage

Go to **Settings → Storage → Reset** to return to the storage-selection screen
and pick a different option.

::: tip Your data is never deleted by switching
Resetting only changes *which* location Organizer reads from. Choose the same
option again and your timelines are exactly where you left them. To move data
*between* locations, use Export then Import.
:::

## Backing up with Export / Import

No matter which mode you use, **Export** is how you make a portable backup.

### Export

**Settings → Backup → Export** downloads **all** your data — timelines, entries,
and attachments — as a single JSON file. Keep it somewhere safe.

Organizer shows a gentle **"No backup · Export now"** nudge in the header if
you're on browser storage and haven't exported in over a week.

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

## Syncing folders across devices with Syncthing

Because folder mode stores your data as **real files**, any file-sync tool can
keep those files in step across several computers. [Syncthing](https://syncthing.net)
is a great fit: it's free, open-source, and syncs directly between your own
devices — peer-to-peer, with no third-party cloud in the middle.

This gives you Organizer on, say, a laptop and a desktop, both reading and
writing the same workspace.

### One-time setup

1. Install Syncthing on each device (see the
   [Syncthing downloads](https://syncthing.net/downloads/)).
2. On the **first** device, pick (or create) the folder you use for Organizer's
   folder storage, and add it as a **shared folder** in Syncthing.
3. **Pair** your devices by exchanging their Device IDs, then share that folder
   with the other device(s).
4. On each **other** device, accept the shared folder and point it at a local
   path. Then open Organizer there, choose **Folder storage**, and pick that
   same synced folder.

That's it — edits on one device land as files, Syncthing copies them across, and
Organizer picks them up.

### How Organizer handles incoming changes

Organizer watches the active workspace for changes that arrive from another
device. When it notices the files were updated elsewhere, it shows an **"Edited
in another window"** prompt; click **Merge in changes** to load the latest
version and keep working. A note you happen to have open in the editor is never
lost — if it also changed on the other device, the other version is kept beside
it as a clearly-marked duplicate.

::: tip Avoid editing the same workspace on two devices at once
Syncthing copies files device-to-device, so a moment of overlap while both are
online is fine. But to keep things tidy, let one device finish syncing before
you start editing on another — especially after a device has been offline.
:::

::: warning Syncing is not a backup
A sync tool faithfully copies your changes — including deletions — to every
device. It is **not** a substitute for backups. Keep periodic
[Exports](#backing-up-with-export-import) as your real safety net.
:::

## Moving to a new device

1. On the old device: **Settings → Backup → Export**.
2. Transfer the JSON file to the new device.
3. On the new device: open Organizer, choose a storage location, then
   **Settings → Backup → Import → Replace all data**.

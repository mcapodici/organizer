---
title: Why Organizer is local-first (and where your data actually lives)
description: A look at local-first apps like Excalidraw, draw.io, Obsidian and Logseq, and the storage options I weighed before settling on browser and folder storage.
date: 2026-06-10
author: The Organizer team
---

# {{ $frontmatter.title }}

<p class="blog-post-meta">{{ new Date($frontmatter.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) }} · {{ $frontmatter.author }}</p>

Most apps you use every day keep your data on someone else's computer. You sign
in, you type, and your notes, drawings, and files live on a server you'll never
see. That's useful right up until the company pivots, raises its prices, gets
acquired, or quietly shuts the service down. *Local-first* software flips that
default: your data lives on **your** device first, and the network, if it's
involved at all, is an enhancement rather than a dependency.

Organizer is built this way on purpose. Before I get to how it stores your data,
it's worth looking at a few apps that have made local-first work well, because
they shaped a lot of the thinking here.

## A few local-first apps worth knowing

**[Excalidraw](https://excalidraw.com)** is the one most people meet first. It's
a virtual whiteboard for hand-drawn-style diagrams, and you can open it and start
drawing without an account. Your scene lives in the browser, and a "save" is
really an export to a `.excalidraw` file (which is just JSON) that you keep
wherever you like. Sharing is opt-in and end-to-end encrypted. The default is
private and local; the cloud is something you reach for, not something you're
signed into.

**[draw.io / diagrams.net](https://www.drawio.com)** takes a similar stance for
more structured diagramming: flowcharts, network diagrams, org charts. It's
pointedly storage-agnostic: it'll happily read and write a diagram straight to a
local file, and the diagram format is open XML. There's no lock-in because
there's nothing to lock you into; the file is yours.

**[Obsidian](https://obsidian.md)** is probably the purest example. Your entire
knowledge base is just a folder of plain Markdown files on your disk. No
database you can't open, no proprietary format. If Obsidian disappeared tomorrow,
every note would still be a readable `.md` file. Sync is an optional paid add-on,
but you're free to use Dropbox, git, or anything else instead, because it's just
files.

**[Logseq](https://logseq.com)** sits right next to Obsidian: an open-source,
outliner-style notebook that also stores everything as local Markdown (or org-mode)
files. Same core promise: the files are the source of truth, and they're yours.

**[Actual Budget](https://actualbudget.org)** is a nice example outside the
note-taking world. It's open-source budgeting software that runs entirely on your
device, with optional self-hosted sync if you want your numbers on more than one
machine. Personal finance is exactly the kind of data you don't want sitting on a
startup's servers, so local-first fits it perfectly.

The thread running through all of these: **the app is a lens over data you own**,
not a window into data the vendor owns. That's the bar I wanted Organizer to
clear.

## The question every local-first app has to answer

Deciding to be local-first is the easy part. The hard part is the very next
question: *if there's no server, where does the data physically go?* Organizer
runs as a static site (a single-page app with no backend of its own), which
narrows the realistic options to a handful. Here's what I considered.

### remoteStorage

[remoteStorage](https://remotestorage.io) is an open protocol that lets an app
read and write to a storage account the **user** controls, completely decoupled
from the app. Philosophically it's lovely. It's exactly the "your data, your
storage" spirit local-first is about, and I genuinely wanted to like it.

In practice I passed on it for two reasons. First, support is thin: there aren't
many providers, so in reality most users would have to find or self-host one,
which is a big ask. Second, the setup is technical enough that it becomes a wall
in front of the app for anyone who isn't already comfortable with this corner of
the web. A storage option that most people can't easily use isn't really an
option.

### Dropbox (and similar file integrations)

Wiring up Dropbox, Google Drive, or OneDrive directly would be more *convenient*
for a lot of people: they already have an account, and sync across devices comes
almost for free. It's a tempting shortcut.

I avoided it for two reasons. The first is principle: I wanted to keep third
parties out of the loop wherever possible. The whole point is that your data
doesn't depend on a company's continued goodwill, and routing everything through
Dropbox quietly reintroduces exactly that dependency. The second is practical:
third-party file integrations on a static SPA tend to be **janky**. You're
juggling OAuth pop-ups, token refreshes, and API quirks from inside a page that
has no backend to hold the credentials or smooth over the rough edges. It's a lot
of fragile moving parts for something that's supposed to feel simple.

### What I landed on: browser storage and folder storage

Organizer offers two storage modes, and neither one involves a third party or a
server:

- **Browser storage** keeps your timelines inside the browser itself, using
  IndexedDB. There's nothing to set up; you open the app and start writing. It
  works fully offline. The trade-off is that it's tied to that one browser on
  that one device, so it leans on Export as a safety net.

- **Folder storage** writes your data as real files into a folder you pick, using
  your browser's [File System Access](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API)
  support. This is the one closest in spirit to Obsidian: your data is just files
  you can see, back up, and sync with whatever tools you already trust. Want it on
  two machines? Point a peer-to-peer sync tool like
  [Syncthing](https://syncthing.net) at the folder — no cloud middleman required.

Between them you get the best of both ends of the spectrum: zero-friction to
start, and full ownership when you want it. Critically, *both* options are 100%
yours. There's no account, no server, and no third party sitting between you and
your own writing.

That's the heart of what local-first means to me, and why Organizer is built the
way it is. If a tool is going to hold a record of your projects, your journal, or
your follow-ups, the least it can do is let you keep that record on your own
terms.

---

*Want to see where your data lives, or move it around? The
[Storage & backup guide](/guide/storage-and-backup) walks through both modes,
exports, and syncing folders across devices.*

# Organizer

A local-first app for keeping chronological logs of anything — client
follow-ups, project progress, journals, research notes. Instead of files and
folders, you work with **timelines**: named logs you add timestamped rich-text
**entries** to over time. There's no account and no server; data lives in the
browser — in the origin private file system (OPFS) where available, falling
back to IndexedDB.

> **Just want to use the app?** This README is for people working on the code.
> For how to *use* Organizer, read the user guide:
> **<https://www.useorganizer.com/guide/introduction>**.

---

## Tech stack

| Area | Choice |
| --- | --- |
| UI | React 19 + TypeScript |
| Build / dev | Vite |
| Routing | React Router |
| Rich text | TipTap (StarterKit + tables, tasks, links, code, highlight…) |
| Local storage | Origin Private File System (OPFS), with [`idb`](https://github.com/jakearchibald/idb) IndexedDB fallback |
| Icons | lucide-react |
| Tests | Vitest + Testing Library + `fake-indexeddb` |
| Docs site | VitePress |
| Hosting | Vercel |

## Prerequisites

- **Node.js 20+** (the toolchain targets current Node; `@types/node` is on v24).
- npm (the repo ships a `package-lock.json`).

## Getting started

```bash
npm install
npm run dev
```

`npm run dev` starts **two** processes concurrently:

- the **app** (Vite) — the React application
- the **docs** (VitePress) — the user guide under `docs/`

Vite will print the local URLs for each. If you only want the app, run
`npm run app:dev`; for docs only, `npm run docs:dev`.

## Available scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Run app + docs dev servers together |
| `npm run app:dev` | App dev server only (Vite) |
| `npm run docs:dev` | Docs dev server only (VitePress) |
| `npm test` | Run the test suite once (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:e2e` | Run browser E2E tests (Playwright, Chromium) |
| `npm run lint` | Lint with ESLint |
| `npm run build` | Full production build: tests → `tsc -b` → build docs → build app |
| `npm run preview` | Preview the built app locally |

> Note: `npm run build` runs the test suite first and fails the build if tests
> fail. Keep tests green.

## Project structure

```
src/
  components/      One folder per UI component (Component.tsx + Component.module.css)
    EntryComposer/   The TipTap-based rich-text editor for new/edited entries
    TimelineView/    A single timeline and its entries
    TimelineList/    Sidebar list of timelines (with tags/filtering)
    TodoPage/        Entries that have due dates, surfaced as todos
    Settings/, Modal/, SearchBox/, TagFilter/, ...  supporting UI
  context/
    StorageContext.tsx   App-wide storage provider; wires the active adapter to the UI
  storage/         The storage abstraction (see below)
    interface.ts     StorageAdapter interface + ConflictError
    opfsAdapter.ts   Origin Private File System adapter (primary)
    idbAdapter.ts    IndexedDB-backed adapter (fallback)
    merge.ts         Cross-tab / cross-source merge logic (has unit + integration tests)
  db/              Low-level IndexedDB schema and stores (timelines, entries, blobs)
  hooks/           Reusable React hooks
  utils/           Pure helpers
  types.ts         Core domain types: Timeline, Entry, etc.

docs/              VitePress user guide (published at useorganizer.com)
public/            Static assets (logo, icons, favicon)
```

## Architecture notes

- **Local-first, no backend.** All data stays on the user's device. There is no
  API layer to call.

- **Two storage backends behind one interface.** Everything in the app talks to
  a `StorageAdapter` (`src/storage/interface.ts`). Two implementations exist:
  - `opfsAdapter` — stores timelines, entries, and binary attachments
    ("blobs") as files in the browser's Origin Private File System. This is
    the primary backend, used wherever OPFS is available (Chrome 86+,
    Safari 15.2+, Edge 86+).
  - `idbAdapter` — stores the same data in IndexedDB. This is the fallback
    for browsers without OPFS (e.g. Firefox).

  `StorageContext` boots OPFS-first and falls back to IndexedDB automatically;
  the user makes no storage choice. When adding storage operations, add them
  to the interface **and both adapters** so the two backends stay in lockstep.

- **`StorageContext` is the seam.** UI components don't import adapters
  directly; they consume the active adapter through `StorageContext`. Prefer
  going through it rather than reaching into `src/db` or a specific adapter.

- **Conflict / merge handling.** Because data can change in another tab or on
  disk underneath us, adapters expose `hasConflict()` / `mergeFromDisk()` and
  the merge logic lives in `src/storage/merge.ts`. It has both unit tests
  (`merge.test.ts`) and an IndexedDB integration test
  (`idbMerge.integration.test.ts`) — if you touch merge behaviour, update them.

## Styling & UI standards

Component styles use **CSS Modules** (`Component.module.css` next to each
component). Before adding or changing UI, read **[`UI_STANDARDS.md`](./UI_STANDARDS.md)**
— it covers the design-token approach, accessibility requirements (visible focus
states, contrast minimums, no hover-only actions), icon usage, and reduced
motion. New code should follow these; older code is migrated toward them
opportunistically.

## Testing

- Tests run on **Vitest** with **Testing Library** and a `jsdom` environment.
- IndexedDB is faked with **`fake-indexeddb`** so storage code is testable
  without a browser.
- Run `npm test` (one-off) or `npm run test:watch` while developing.
- Browser end-to-end tests run on **Playwright** (Chromium only) from
  `e2e/*.spec.ts` — `npm run test:e2e`. Playwright starts the Vite dev server
  on port 5174 itself. First time on a machine: `npx playwright install
  chromium`.
- The storage/merge layer is the most safety-critical area — keep its coverage
  intact when changing it.

## Documentation

The user-facing guide lives in **`docs/`** (VitePress) and is published at
<https://www.useorganizer.com/guide/introduction>. If your change alters
user-visible behaviour, update the relevant guide page in `docs/guide/`. Run
`npm run docs:dev` to preview docs locally.

## Deployment

The app is hosted on **Vercel** (`vercel.json`). `npm run build` produces the
production output in `dist/`, which includes both the app and the built docs.

## Contributing checklist

Before opening a PR:

1. `npm run lint` passes.
2. `npm test` passes (and you've added/updated tests for behaviour you changed —
   especially in `src/storage`).
3. New/changed UI follows [`UI_STANDARDS.md`](./UI_STANDARDS.md).
4. Storage changes are reflected in **both** adapters and the interface.
5. User-facing changes are reflected in the `docs/` guide.
6. `npm run build` succeeds end-to-end.

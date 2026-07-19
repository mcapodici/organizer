# Organizer — Project Context

Local-first React/TypeScript PWA for chronological logs. Users create **timelines** and add timestamped rich-text **entries**. No account, no server; data lives in the browser (IndexedDB) or a user-picked folder (File System Access API / OPFS).

Live at: https://www.useorganizer.com

## Tech Stack

| Area | Choice |
|---|---|
| UI | React 19 + TypeScript |
| Build | Vite |
| Routing | React Router |
| Rich text | TipTap |
| Storage | IndexedDB (`idb`), File System Access API, OPFS |
| Tests | Vitest + Testing Library |
| Hosting | Vercel |

## Key Commands

```bash
npm run app:dev          # start app dev server on :5174
npm test                 # vitest run (must pass before any merge)
npm run lint             # eslint (must be clean)
npx tsc --noEmit -p tsconfig.app.json   # type check (must exit 0)
npm run build            # full build (tests + types + vitepress + vite)
npm run deploy:preview   # deploy preview branch to Vercel, prints URL
```

## Coding Standards

Read `UI_STANDARDS.md` before making any UI changes — it is the authoritative style guide.

- TypeScript strict mode; no `any` without justification
- No comments unless the WHY is non-obvious
- Prefer editing existing files over creating new ones
- All new UI components must follow UI_STANDARDS.md
- Keep components small and focused
- Use existing patterns from the codebase before inventing new ones

## Pipeline Conventions

This project uses an automated development pipeline. See `.kanban/` for ticket state.

**Ticket stages:** `backlog → grooming → ready → in-progress → review → staging → done`

**Commit prefixes:**
- `pipeline: <description>` — state transitions made by pipeline agents
- `feat: <description>` — feature work committed in worktrees
- `fix: <description>` — bug fixes
- `chore: <description>` — maintenance

**Worktrees:** pipeline creates branches named `pipeline/<ticket-id>` and worktrees at `.worktrees/<ticket-id>`.

## Key Files

- `UI_STANDARDS.md` — UI style guide (read before any UI work)
- `.kanban/` — pipeline ticket state (git-tracked)
- `src/context/StorageContext.tsx` — storage state machine
- `src/adapters/` — storage backends (IdbAdapter, FileAdapter)
- `src/components/` — React components
- `src/hooks/` — custom React hooks

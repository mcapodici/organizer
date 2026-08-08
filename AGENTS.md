# Agent Instructions for Organizer

This file provides conventions for AI agents working on this repo. The only
supported agent harness is [Atomic](https://github.com/bastani/atomic).

## Workflow

### Starting work on a feature / fix

1. **Create a branch via `git worktree`** — never commit directly to `main`.
   - Worktrees keep the working directory clean and let you context-switch without stashing.
   - Example:
     ```bash
     git worktree add .worktrees/my-feature my-feature 2>/dev/null || \
       git worktree add .worktrees/my-feature -b my-feature main
     ```
   - The `.worktrees/` directory is already gitignored.

2. Make changes in the worktree directory, commit, push.

### Delegated and parallel work

If you split work across subagents or workflow stages, create (or reuse) **one
shared worktree for the whole run** — not one per task — and tell every child to
`cd` into it. All tasks in a run land as separate commits on the same branch,
ready for a single push/PR/preview at the end.

Never let a delegated agent commit to `main`.

### Skills

Project skills live in `.atomic/skills/`. Currently:

- **`doc-check`** — detects when `docs/` has drifted out of date relative to
  `src/` changes and proposes a plan. It never edits files itself.

### Before completing any task

3. **Run all checks** before finishing — lint, tests, TypeScript, docs build, and app build:
   ```bash
   npm run check
   ```
   This runs `scripts/check.sh` (lint → tests → TypeScript → VitePress docs build → Vite app build). Everything must pass.

### When ready for human review (preview)

4. **Deploy a preview** so the human can test the changes live:
   ```bash
   npm run deploy:preview
   ```
   This runs `scripts/deploy-preview.sh` — it runs tests, builds, deploys to Vercel preview, and prints the preview URL.

### Production deployment

5. **Deploy to production** when the feature is approved:
   ```bash
   bash scripts/deploy.sh
   ```
   This runs `scripts/deploy.sh` — TypeScript check, tests, then `vercel deploy --prod`. Aliases to `chaseups.vercel.app`.

## Project conventions

- **UI standards**: see `UI_STANDARDS.md` for design tokens, component conventions, and accessibility rules.
- **Review process**: see `CHANGES_REVIEW.md` for the change-log and review expectations.
- **Tests**: Vitest + Testing Library + `fake-indexeddb`. Run `npm test` before declaring anything done.
- **Build**: `npm run build` (runs tests → tsc → VitePress docs → Vite app).
- **Lint**: `npm run lint` (ESLint). Note that repo-wide lint is **currently red on `main`** (~21 pre-existing errors, mostly `src/hooks/useTodoCounts.ts` and `vite.config.ts`). Don't take fixing those on as a side quest — just keep the files *you* touch clean: `npx eslint <your changed files>`.

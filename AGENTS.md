# Agent Instructions for Organizer

This file provides conventions for AI agents (Hermes, Claude Code, etc.) working on this repo.

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

### Automated task-list runs (`markdown-tasks:do-one-task` / `markdown-tasks:do-all-tasks`)

The `do-task` agent's own completion step normally runs `/orchestration:finish` to handle worktrees, commits, and rebasing — but that command isn't installed in this environment, so `do-task` silently falls back to committing directly on `main` if not told otherwise. This violates rule 1 above. To avoid that:

- Before dispatching any `do-task` agent, the orchestrating agent must first create (or reuse) **one shared worktree for the whole run** — same command as rule 1 — not a separate worktree per task.
- Each `do-task` agent must be explicitly told to `cd` into that worktree directory and do all its work there.
- All tasks processed in one run land as separate commits on that same branch, ready for one push/PR/preview at the end.

### Before completing any task

3. **Run all checks** before finishing — tests, TypeScript, docs build, and app build:
   ```bash
   npm run check
   ```
   This runs `scripts/check.sh` (`npm test` + `npm run build`). Everything must pass.

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
- **Lint**: `npm run lint` (ESLint). Fix all warnings before committing.

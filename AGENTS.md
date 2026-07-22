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

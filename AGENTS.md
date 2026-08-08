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

- **Node version**: `mise.toml` selects **26**. The suite is verified on 22, 24
  and 26, so `engines.node` is `>=22` and Vercel may pick any of them. Use
  `mise x -- npm …` if your shell resolves something else.
- **UI standards**: see `UI_STANDARDS.md` for design tokens, component conventions, and accessibility rules.
- **Review process**: see `CHANGES_REVIEW.md` for the change-log and review expectations.
- **Tests**: Vitest + Testing Library + `fake-indexeddb`. Run `npm test` before declaring anything done.
- **Build**: `npm run build` (runs tests → tsc → VitePress docs → Vite app).
- **Lint**: `npm run lint` (ESLint). Currently clean.

## The localStorage trap

Node 26 exposes the built-in Web Storage API as a global, so `localStorage` is
an own property of `globalThis` before jsdom ever loads — and it reads back as
`undefined` unless the process was started with `--localstorage-file`. (Node
22.23.2 and 24.19.0 are unaffected; 26.7.0 is affected.)

Vitest builds its jsdom global via `populateGlobal`, which skips any key already
present on the global object unless that key is in its own allow-list. That
allow-list does not include `localStorage`, so Node's inert version wins and
jsdom's real `Storage` is never installed. `window.localStorage` is undefined
too, because Vitest sets `global.window = global`.

The symptom is `TypeError: Cannot read properties of undefined (reading 'clear')`
in `src/App.test.tsx`, and it looks nothing like a Node upgrade.

`src/test-setup.ts` installs an in-memory `Storage` when the global is missing
or inert, and no-ops where jsdom's own survives. `src/test-setup.test.ts` guards
it. If you change the test environment, keep both.

You are implementing an approved change to **Organizer**, a React + TypeScript timeline/journal app (Vite, Vitest, VitePress docs, IndexedDB storage).

You are already on branch `{{SOURCE_BRANCH}}`, forked from the latest `main`. Work here and commit your changes.

Read `AGENTS.md`, `UI_STANDARDS.md`, and `CHANGES_REVIEW.md` before you start — they define this repo's conventions and you are expected to follow them.

## The request

GitHub issue #{{ISSUE_NUMBER}}: {{ISSUE_TITLE}}

{{ISSUE_BODY}}

## The approved plan

A human reviewed and approved this plan. Implement it.

{{APPROVED_PLAN}}

## How to work

Follow the approved plan. It is the agreed scope: do not quietly widen it with refactors, renames, or drive-by fixes nobody asked for, and do not narrow it — every step needs to land.

If you discover while implementing that a step in the plan is wrong or impossible, implement everything else in full, do the most sensible thing for the broken step, and say clearly in your final message what you deviated from and why. Do not stop with the work half-done.

Match the surrounding code: its naming, its comment density, its idioms. New tests go beside their neighbours and use the same style — Vitest + Testing Library + `fake-indexeddb`, as in the existing `src/**/*.test.ts` files.

**Behaviour changes need tests.** If you changed what the app does and no test would catch a regression, you are not finished.

## Before you finish

Run the repo gate and get it green:

```
npm run check
```

That is `scripts/check.sh` — `vitest run --no-file-parallelism`, then `tsc -b`, then `vitepress build docs`, then `vite build`. All four must pass. Fix what you broke; do not disable, skip, or weaken tests to get past them, and do not edit `scripts/check.sh` or the tsconfig files.

### About lint

`npm run lint` is **already failing on `main`** — there are around 21 pre-existing ESLint errors in files such as `src/hooks/useTodoCounts.ts` and `vite.config.ts`. Those are not yours and you must **not** go and fix them; that would balloon this change far beyond the approved plan.

What is expected of you: don't add *new* lint problems in the files you touch. Run `npx eslint <the files you changed>` and clear anything your own edits introduced. If a file you had to edit was already red before you touched it, leave those pre-existing errors alone and say so in your final message.

Commit your work in logical commits with clear messages. Do not push, do not open a pull request, and do not touch git remotes — the orchestrator does that once the gate passes.

Do not run `npm run deploy:preview` or `scripts/deploy.sh`. Deployment is the human's call.

When the gate is green and your work is committed, emit `<promise>COMPLETE</promise>`.

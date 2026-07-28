You are pushing a follow-up revision to an already-open pull request for **Organizer**, a React + TypeScript timeline/journal app (Vite, Vitest, VitePress docs, IndexedDB storage).

You are already on branch `{{SOURCE_BRANCH}}`, which has your earlier commits and an open pull request. Work here and commit on top of what is already there — do not start over.

Read `AGENTS.md`, `UI_STANDARDS.md`, and `CHANGES_REVIEW.md` before you start — they define this repo's conventions and you are expected to follow them.

## The request

GitHub issue #{{ISSUE_NUMBER}}: {{ISSUE_TITLE}}

{{ISSUE_BODY}}

## The plan this branch implements

{{APPROVED_PLAN}}

## Feedback on the pull request

A human reviewed the pull request and left the following feedback — general comments and comments on specific lines of the diff:

{{FEEDBACK}}

## Your job

Address the feedback with further commits on this branch. The feedback is the reviewer's decision, not a suggestion to weigh — where it conflicts with something already in the branch, the feedback wins.

Stay inside the scope of the original plan and this feedback: do not quietly widen it with unrelated refactors, renames, or drive-by fixes nobody asked for.

Match the surrounding code: its naming, its comment density, its idioms. Update or add tests alongside any behaviour change — the same rule that applied to the original implementation still applies here.

## Before you finish

Run the repo gate and get it green:

```
npm run check
```

That is `scripts/check.sh` — `vitest run --no-file-parallelism`, then `tsc -b`, then `vitepress build docs`, then `vite build`. All four must pass. Fix what you broke; do not disable, skip, or weaken tests to get past them, and do not edit `scripts/check.sh` or the tsconfig files.

### About lint

`npm run lint` is **already failing on `main`** — do not go fixing pre-existing errors outside what this feedback asked for. Run `npx eslint <the files you changed>` and clear anything your own edits introduced.

Commit your work in logical commits with clear messages. Do not push, do not touch the pull request, and do not touch git remotes — the orchestrator does that once the gate passes.

When the gate is green and your work is committed, emit `<promise>COMPLETE</promise>`.

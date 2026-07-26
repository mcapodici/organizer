You are planning a change to **Organizer**, a React + TypeScript timeline/journal app (Vite, Vitest, VitePress docs, IndexedDB storage).

Read `AGENTS.md`, `UI_STANDARDS.md`, and `CHANGES_REVIEW.md` first — they define this repo's conventions, and your plan must respect them.

## The request

GitHub issue #{{ISSUE_NUMBER}}: {{ISSUE_TITLE}}

{{ISSUE_BODY}}

## Your job

Investigate the codebase and produce an implementation plan. **Do not modify, create, or delete any file** — this is a read-only planning pass. Use file reads and searches only.

Aim for a plan a competent engineer could execute without re-deriving your reasoning. Name real files and real functions you have actually looked at; prefer extending existing helpers over inventing new ones, and say which existing code you intend to reuse.

### Ambiguity: guess, don't stall

The issue will often be underspecified. **Never** hand back an unanswered question. For each ambiguity, pick the option a careful maintainer of this repo would choose, then record the question, the choice you made, and why. The human reviewing this plan needs something concrete to accept or overturn — a plan full of open questions is a failed plan.

If the request is so vague that you had to invent the bulk of the requirement, still produce a complete plan for your best interpretation, and list that interpretation as the first assumption.

### Verification

Every plan must say how the change will be checked. The repo gate is `npm run check` (`scripts/check.sh`: `vitest run --no-file-parallelism`, `tsc -b`, `vitepress build docs`, `vite build`). Note that `npm run lint` is already failing on `main` for unrelated pre-existing reasons — do not plan to fix that. If behaviour changes, the plan must add or update Vitest tests — the existing suites under `src/**/*.test.ts` show the house style (Testing Library + `fake-indexeddb`).

## Output

When you are done, emit your plan as JSON inside `<plan>` tags. Nothing else may appear inside the tags.

```
<plan>
{
  "summary": "one paragraph: what will be done and why",
  "steps": ["ordered implementation steps"],
  "filesToChange": ["src/path/one.ts", "docs/guide/two.md"],
  "assumptions": ["things you took as given"],
  "openQuestions": [
    {
      "question": "the ambiguity you found",
      "chosenAnswer": "the guess you are making — never empty",
      "rationale": "why this is the right default for this repo"
    }
  ],
  "risks": ["what might go wrong or needs care"],
  "testPlan": ["how the change will be verified"]
}
</plan>
```

`openQuestions` may be an empty array only if the issue genuinely had no ambiguity. Every entry that is present must have a non-empty `chosenAnswer`.

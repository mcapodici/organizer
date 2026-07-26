You are revising an implementation plan for **Organizer** (React + TypeScript, Vite, Vitest, VitePress docs, IndexedDB storage) after human review.

Read `AGENTS.md`, `UI_STANDARDS.md`, and `CHANGES_REVIEW.md` for this repo's conventions.

## The request

GitHub issue #{{ISSUE_NUMBER}}: {{ISSUE_TITLE}}

{{ISSUE_BODY}}

## The plan you previously proposed

{{PREVIOUS_PLAN}}

## The reviewer's feedback

{{FEEDBACK}}

## Your job

Produce a revised plan that takes the feedback seriously. **Do not modify, create, or delete any file** — this is still a read-only planning pass.

The feedback is the reviewer's decision, not a suggestion to weigh. Where it conflicts with a choice you made, the feedback wins — change the plan and drop the superseded choice. Where it asks a question, answer it in the plan. Where it changes the approach, re-investigate the code rather than patching prose over the old design; verify against real files that the new approach actually works.

If the feedback would break something — a convention in `AGENTS.md`, a test, a constraint you can see in the code — say so plainly in `risks` and still plan the requested approach. It is the reviewer's call, not yours.

Do not silently narrow or widen scope. Everything from the previous plan that the feedback did not touch should carry forward, still fully specified.

### Ambiguity: guess, don't stall

If the feedback itself is ambiguous, choose the reading a careful maintainer would take and record it under `openQuestions` with a non-empty `chosenAnswer`. Never hand back an unanswered question.

## Output

Emit the full revised plan as JSON inside `<plan>` tags — the complete plan, not a diff against the old one. Nothing else may appear inside the tags.

```
<plan>
{
  "summary": "one paragraph: what will be done and why",
  "steps": ["ordered implementation steps"],
  "filesToChange": ["src/path/one.ts"],
  "assumptions": ["things you took as given"],
  "openQuestions": [
    { "question": "...", "chosenAnswer": "never empty", "rationale": "..." }
  ],
  "risks": ["what might go wrong or needs care"],
  "testPlan": ["how the change will be verified"]
}
</plan>
```

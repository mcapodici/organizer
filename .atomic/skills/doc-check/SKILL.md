---
name: doc-check
description: Checks whether docs/index.md, docs/guide/**, docs/tutorials/**, and docs/use-cases/** are stale relative to recent src/ changes, and proposes a plan of doc updates. Never touches docs/blog/** (historical posts). Invoke manually via /doc-check.
---

# doc-check

This skill detects when the user-facing docs under `docs/` have drifted out of
date relative to app code changes under `src/`, and proposes a plan of doc
updates. It never edits files itself.

## In scope

- `docs/index.md`
- `docs/guide/**`
- `docs/tutorials/**`
- `docs/use-cases/**`

## Out of scope — never edit or propose edits to these

- `docs/blog/**` — historical blog posts, frozen "as of the time written".
- Root dev docs: `README.md`, `AGENTS.md`, `UI_STANDARDS.md`,
  `CHANGES_REVIEW.md`.
- Docs-site meta files: `docs/source.md`, `docs/README.md`.

## Steps

1. Run the helper script to get, per in-scope doc file, its last-touched
   commit (hash + date + subject) and the list of commits/files under `src/`
   that have landed since that commit:

   ```bash
   .claude/skills/doc-check/scripts/find-stale-docs.sh
   ```

2. For each doc file with non-empty code changes since its last update:
   - Read the current doc content.
   - Read the relevant `src/` diff (`git diff <hash>..HEAD -- src/`), narrowed
     by judgement to files plausibly related to that doc's topic — e.g.
     `docs/guide/tags-and-search.md` should look for changes under
     tag/search-related components.
   - Decide whether the change is doc-worthy (new/changed user-facing
     behavior, new feature, changed workflow) versus not (refactor, styling,
     test-only, internal-only change).

3. Explicitly state that `docs/blog/**` is out of scope and must never be
   edited or proposed for edits — call this out every run, even if nothing
   else in the plan concerns it, so the rule is visibly considered each time.

4. Compile findings into a plan: one entry per doc file that needs attention,
   describing what changed in the code and what the doc should say instead —
   concrete enough to act on, but do not apply the edit yourself.

5. If no doc looks stale, say so plainly rather than manufacturing busy-work.

6. Always end the turn (whether or not anything was found) by using
   `AskUserQuestion` with exactly these three choices:
   - **Implement now** — make the edits directly in this conversation.
   - **Store as tasks for later** — hand off to the `markdown-tasks:plan-tasks`
     skill so each proposed doc update becomes a self-contained task in
     `.llm/todo.md`.
   - **Other** — let the user describe a different next step.

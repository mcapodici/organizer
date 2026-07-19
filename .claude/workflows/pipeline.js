// NOTE: top-level `return` and `await` are valid in CC's workflow runtime.
// `node --check` reports them as syntax errors — that's a false positive.
// Run this via: claude -p "/pipeline"  (not node directly)

export const meta = {
  name: 'pipeline',
  description: 'Organizer dev pipeline — scans kanban and processes one ticket per stage per run',
}

const TICKET_SCHEMA = {
  type: 'object',
  required: ['id', 'title', 'stage', 'filename', 'body'],
  properties: {
    id:            { type: 'string' },
    title:         { type: 'string' },
    stage:         { type: 'string' },
    filename:      { type: 'string' },
    body:          { type: 'string' },
    branch:        { type: 'string' },
    worktree_path: { type: 'string' },
    pr_url:        { type: 'string' },
    preview_url:   { type: 'string' },
  },
}

const KANBAN_SCHEMA = {
  type: 'object',
  required: ['backlog', 'grooming', 'ready', 'inProgress', 'review', 'staging'],
  properties: {
    backlog:    { type: 'array', items: TICKET_SCHEMA },
    grooming:   { type: 'array', items: TICKET_SCHEMA },
    ready:      { type: 'array', items: TICKET_SCHEMA },
    inProgress: { type: 'array', items: TICKET_SCHEMA },
    review:     { type: 'array', items: TICKET_SCHEMA },
    staging:    { type: 'array', items: TICKET_SCHEMA },
  },
}

// --- LOCK ---
// Acquire lock or bail. Lock is stale if >2 hours old.
const lock = await agent(
  'Check if .kanban/.lock exists. ' +
  'If it exists: read its contents (an ISO timestamp). If the timestamp is more than 2 hours ago, delete the file and return {"locked": false, "since": "stale"}. Otherwise return {"locked": true, "since": "<contents>"}. ' +
  'If it does not exist: create it with the current ISO 8601 timestamp as the only contents, then return {"locked": false, "since": ""}.',
  {
    schema: {
      type: 'object',
      required: ['locked'],
      properties: { locked: { type: 'boolean' }, since: { type: 'string' } },
    },
    label: 'lock',
  }
)

if (lock.locked) {
  return `Skipped: pipeline locked since ${lock.since}`
}

try {
  // --- SCAN ---
  const kanban = await agent(
    'Read every .md file in these six directories: ' +
    '.kanban/backlog/, .kanban/grooming/, .kanban/ready/, .kanban/in-progress/, .kanban/review/, .kanban/staging/ ' +
    '(skip .gitkeep files). ' +
    'For each file parse the YAML frontmatter block (between --- markers) and capture all fields plus the markdown body after the frontmatter. ' +
    'Return JSON with keys backlog, grooming, ready, inProgress, review, staging — each an array of ticket objects with fields: id, title, stage, filename (full relative path from repo root), body, branch, worktree_path, pr_url, preview_url.',
    { schema: KANBAN_SCHEMA, label: 'scan' }
  )

  const { backlog, grooming, ready, inProgress, review, staging } = kanban
  const summary = []

  // --- GROOM: backlog[0] → grooming or ready ---
  if (backlog.length > 0) {
    const t = backlog[0]
    await agent(
      `You are the groomer for the organizer project pipeline.

Ticket to groom:
FILE: ${t.filename}
CONTENT:
${t.body}

A ticket is READY to implement autonomously if it has:
- A clear description of what to change and why
- Specific acceptance criteria or expected behaviour
- No ambiguity that would require a developer to guess

If READY:
1. Update the file ${t.filename}: set frontmatter field "stage" to "ready"
2. Rename/move it to .kanban/ready/${t.id}.md
3. Run: git add -A && git commit -m "pipeline: groom ${t.id} → ready"

If NEEDS CLARIFICATION:
1. Identify the 1-3 most important missing pieces (be specific)
2. Update ${t.filename}: set frontmatter field "stage" to "grooming"
3. Move it to .kanban/grooming/${t.id}.md
4. Create .kanban/questions/${t.id}.md with this exact structure:

---
ticket_id: ${t.id}
ticket_title: ${t.title}
type: question
status: pending
asked_at: <current ISO timestamp>
answered_at:
answer:
---

<numbered list of specific questions, one per line>

5. Run: git add -A && git commit -m "pipeline: groom ${t.id} → grooming (questions pending)"`,
      { label: `groom:${t.id}` }
    )
    summary.push(`groomed: ${t.id}`)
  }

  // --- CHECK ANSWERS: grooming tickets waiting on human ---
  for (const t of grooming) {
    await agent(
      `You are the groomer for the organizer project pipeline.

Check if the human has answered questions for this ticket.

TICKET: ${t.filename}
QUESTIONS FILE: .kanban/questions/${t.id}.md

Read .kanban/questions/${t.id}.md and check the "status" field.

If status is "answered":
1. Read the "answer" field and incorporate any relevant details into the ticket body
2. Update ${t.filename}: set stage to "ready", move to .kanban/ready/${t.id}.md
3. Delete .kanban/questions/${t.id}.md
4. Run: git add -A && git commit -m "pipeline: groom ${t.id} → ready (questions answered)"

If status is still "pending": do nothing.`,
      { label: `check-answers:${t.id}` }
    )
  }

  // --- CODE: ready[0] → in-progress (only if nothing currently coding) ---
  if (ready.length > 0 && inProgress.length === 0) {
    const t = ready[0]
    const branch = `pipeline/${t.id}`
    const worktreePath = `.worktrees/${t.id}`
    await agent(
      `You are the coder agent for the organizer project pipeline.

Implement this ticket in an isolated git worktree.

TICKET FILE: ${t.filename}
FULL TICKET:
${t.body}

BRANCH: ${branch}
WORKTREE: ${worktreePath}

STEPS — follow in order, do not skip:

1. Create the worktree:
   git worktree add ${worktreePath} -b ${branch}

2. Update ticket frontmatter in ${t.filename}:
   - stage: "in-progress"
   - branch: "${branch}"
   - worktree_path: "${worktreePath}"
   - started_at: <current ISO timestamp>
   Move to .kanban/in-progress/${t.id}.md
   Run: git add -A && git commit -m "pipeline: start ${t.id} → in-progress"

3. Read CLAUDE.md and UI_STANDARDS.md before writing any code.

4. Implement the ticket in ${worktreePath}. Work only in that directory.

5. In ${worktreePath}, verify your work passes all gates:
   npm test
   npm run lint
   npx tsc --noEmit -p tsconfig.app.json
   Fix any failures before continuing.

6. Commit in ${worktreePath}:
   git add -A && git commit -m "feat: ${t.title}"

7. Push: git push -u origin ${branch}

8. Update .kanban/in-progress/${t.id}.md:
   - stage: "review"
   - completed_at: <current ISO timestamp>
   Move to .kanban/review/${t.id}.md
   Run: git add -A && git commit -m "pipeline: ${t.id} → review"`,
      { label: `code:${t.id}` }
    )
    summary.push(`coding: ${t.id}`)
  }

  // --- REVIEW: review[0] → staging or back to ready ---
  if (review.length > 0) {
    const t = review[0]
    const branch = t.branch || `pipeline/${t.id}`
    const worktreePath = t.worktree_path || `.worktrees/${t.id}`
    await agent(
      `You are the reviewer for the organizer project pipeline.

Review the implementation for this ticket. Be thorough — once approved it goes to staging for human sign-off.

TICKET: ${t.filename}
BRANCH: ${branch}
WORKTREE: ${worktreePath}

REVIEW CHECKLIST — all must pass to approve:
□ npm test passes in ${worktreePath}
□ npm run lint passes in ${worktreePath}
□ npx tsc --noEmit -p tsconfig.app.json passes in ${worktreePath}
□ Changes match the ticket's acceptance criteria
□ UI changes comply with UI_STANDARDS.md
□ No regressions in unrelated functionality
□ Code is clean: no unnecessary comments, no leftover debug code, no any types

TO APPROVE:
1. Get a preview URL: run npm run deploy:preview in ${worktreePath} and capture the URL
2. Update ${t.filename}: set stage to "staging", add preview_url: <url>
3. Move to .kanban/staging/${t.id}.md
4. Create .kanban/questions/staging-${t.id}.md:

---
ticket_id: ${t.id}
ticket_title: ${t.title}
type: approval
preview_url: <vercel preview url>
status: pending
asked_at: <current ISO timestamp>
answered_at:
answer:
---

Please review and approve or reject this change.
Preview: <vercel preview url>

5. Run: git add -A && git commit -m "pipeline: ${t.id} → staging"

TO REJECT:
1. Document exactly what needs fixing (be specific — the coder will use these notes)
2. Update ${t.filename}: set stage to "ready", add review_notes: "<reason>"
3. Move to .kanban/ready/${t.id}.md
4. Run: git add -A && git commit -m "pipeline: ${t.id} → ready (rejected: <short reason>)"`,
      { label: `review:${t.id}` }
    )
    summary.push(`reviewed: ${t.id}`)
  }

  // --- CHECK APPROVAL: staging tickets waiting on human ---
  for (const t of staging) {
    const branch = t.branch || `pipeline/${t.id}`
    const worktreePath = t.worktree_path || `.worktrees/${t.id}`
    await agent(
      `You are the pipeline manager for the organizer project.

Check if the human has approved or rejected this staging ticket.

TICKET: ${t.filename}
APPROVAL FILE: .kanban/questions/staging-${t.id}.md

Read .kanban/questions/staging-${t.id}.md and check the "status" field.

If status is "approved":
1. Merge: git merge ${branch} --no-ff -m "merge: ${t.title}"
2. Push: git push origin main
3. Remove worktree: git worktree remove ${worktreePath} --force
4. Delete branch: git push origin --delete ${branch} && git branch -d ${branch}
5. Update ticket: stage → "done", merged_at: <ISO timestamp>
6. Move .kanban/staging/${t.id}.md → .kanban/done/${t.id}.md
7. Delete .kanban/questions/staging-${t.id}.md
8. Run: git add -A && git commit -m "pipeline: ${t.id} → done"

If status is "rejected":
1. Read the answer field for rejection reason
2. Update ticket body to include rejection notes
3. Set stage → "ready"
4. Move .kanban/staging/${t.id}.md → .kanban/ready/${t.id}.md
5. Delete .kanban/questions/staging-${t.id}.md
6. Run: git add -A && git commit -m "pipeline: ${t.id} → ready (staging rejected)"

If status is "pending": do nothing.`,
      { label: `check-approval:${t.id}` }
    )
  }

  return summary.length > 0 ? summary.join(', ') : 'no work this tick'

} finally {
  await agent('Delete .kanban/.lock if it exists.', { label: 'unlock' })
}

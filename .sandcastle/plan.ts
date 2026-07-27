/**
 * The planning half of the pipeline: run a planner agent, render its
 * structured output into a reviewable comment, and post it.
 *
 * The planner never writes to the issue itself — it returns structured data
 * and the host does the GitHub I/O.
 */
import { run, Output } from '@ai-hero/sandcastle'
import { z } from 'zod'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import {
  planner,
  sandbox,
  REPO_DIR,
  BASE_BRANCH,
  PLAN_MARKER,
  PLAN_FOOTER_MARKER,
  LABELS,
} from './config.ts'
import { addComment, type Comment, type Issue } from './github.ts'

const exec = promisify(execFile)

/**
 * Resolved lazily rather than at module load: the pure helpers below are unit
 * tested under vitest's jsdom environment, where `import.meta.url` is not a
 * `file:` URL and this would throw on import.
 */
const promptDir = () => fileURLToPath(new URL('./prompts/', import.meta.url))

/**
 * `chosenAnswer` is required, which is what guarantees the plan is always
 * actionable: the model cannot hand back a bare question, it must commit to a
 * guess that the human can accept or overturn.
 */
const PlanSchema = z.object({
  summary: z.string().describe('One paragraph: what will be done and why.'),
  steps: z.array(z.string()).min(1).describe('Ordered implementation steps.'),
  filesToChange: z.array(z.string()).describe('Repo-relative paths expected to change.'),
  assumptions: z.array(z.string()).describe('Things taken as given without being told.'),
  openQuestions: z
    .array(
      z.object({
        question: z.string(),
        chosenAnswer: z.string().describe('The guess being made. Never empty.'),
        rationale: z.string(),
      }),
    )
    .describe('Ambiguities found, each already resolved with a best guess.'),
  risks: z.array(z.string()).describe('What might go wrong or need care.'),
  testPlan: z.array(z.string()).describe('How the change will be verified.'),
})

export type Plan = z.infer<typeof PlanSchema>

/** Strip interactive checkboxes from agent text so a plan never renders one. */
export const deCheckbox = (s: string) => s.replace(/^(\s*)[-*]\s+\[[ xX]\]\s+/gm, '$1- ')

const bullets = (items: string[]) =>
  items.length === 0 ? '_none_' : items.map((i) => `- ${deCheckbox(i)}`).join('\n')

/** Render a plan into the comment body, including the approval instructions. */
export function renderPlan(issue: number, revision: number, plan: Plan): string {
  const choices =
    plan.openQuestions.length === 0
      ? '_None — the issue was unambiguous._'
      : plan.openQuestions
          .map(
            (q) =>
              `- **${deCheckbox(q.question)}**\n  - Chose: ${deCheckbox(q.chosenAnswer)}\n  - Why: ${deCheckbox(q.rationale)}`,
          )
          .join('\n')

  return `<!-- ${PLAN_MARKER} issue=${issue} revision=${revision} -->
### Plan for #${issue} — revision ${revision}

${deCheckbox(plan.summary)}

**Steps**
${bullets(plan.steps)}

**Files expected to change**
${bullets(plan.filesToChange)}

**Assumptions**
${bullets(plan.assumptions)}

**Choices made on ambiguous points**
${choices}

**How it will be verified**
${bullets(plan.testPlan)}

**Risks**
${bullets(plan.risks)}

---
<!-- ${PLAN_FOOTER_MARKER} -->
**To proceed:** add the \`${LABELS.proceed}\` label to this issue to approve this plan and start implementation.

Not right? Reply with feedback in a comment and a revised plan will be posted.
`
}

/** Find the newest plan comment on an issue, if any. */
export function latestPlanComment(comments: Comment[]): Comment | undefined {
  return comments.filter((c) => c.body.includes(`<!-- ${PLAN_MARKER}`)).at(-1)
}

export function revisionOf(comment: Comment): number {
  const m = comment.body.match(/revision=(\d+)/)
  return m ? Number(m[1]) : 1
}

/** Extract the human-readable plan text to hand to the implementer. */
export function planBodyForImplementer(comment: Comment): string {
  const start = comment.body.indexOf('###')
  const end = comment.body.indexOf(`<!-- ${PLAN_FOOTER_MARKER} -->`)
  if (start === -1) return comment.body
  return comment.body.slice(start, end === -1 ? undefined : end).trim()
}

async function deleteBranch(branch: string): Promise<void> {
  try {
    await exec('git', ['branch', '-D', branch], { cwd: REPO_DIR })
  } catch {
    // Best effort — the branch may never have been created.
  }
}

/**
 * Run the planner (or reviser) and post the resulting plan as a new comment.
 * Returns the revision number that was posted.
 */
export async function runPlanner(
  issue: Issue,
  opts: { previousPlan?: string; feedback?: string; revision?: number } = {},
): Promise<number> {
  const revising = Boolean(opts.previousPlan && opts.feedback)
  const branch = `sandcastle/plan-${issue.number}`

  const result = await run({
    agent: planner(),
    sandbox: sandbox(),
    cwd: REPO_DIR,
    name: `plan-${issue.number}`,
    promptFile: `${promptDir()}${revising ? 'revise-plan.md' : 'plan.md'}`,
    // Untrusted issue text goes through promptArgs, never into the prompt
    // file: sandcastle strips its shell-expansion marker from substituted
    // values, so `!\`cmd\`` in an issue body cannot be executed.
    promptArgs: {
      ISSUE_NUMBER: issue.number,
      ISSUE_TITLE: issue.title,
      ISSUE_BODY: issue.body || '(no description given)',
      ...(revising
        ? { PREVIOUS_PLAN: opts.previousPlan!, FEEDBACK: opts.feedback! }
        : {}),
    },
    maxIterations: 1,
    // A throwaway branch keeps any stray commit off main; the planner is told
    // not to modify anything, and the branch is deleted afterwards.
    branchStrategy: { type: 'branch', branch, baseBranch: BASE_BRANCH },
    completionSignal: ['</plan>', '<promise>COMPLETE</promise>'],
    output: Output.object({ tag: 'plan', schema: PlanSchema, maxRetries: 2 }),
  })

  await deleteBranch(branch)

  const revision = revising ? (opts.revision ?? 1) + 1 : 1
  await addComment(issue.number, renderPlan(issue.number, revision, result.output))
  return revision
}

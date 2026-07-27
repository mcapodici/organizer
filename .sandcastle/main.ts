/**
 * Issue-driven agent pipeline for Organizer.
 *
 * Polls GitHub for issues carrying an `agent:*` label and advances each one
 * through plan → human review → implementation → pull request.
 *
 * The labels on the issue ARE the state. Nothing important is held in memory,
 * so the process can be killed and restarted at any point.
 *
 *   npx tsx .sandcastle/main.ts --setup     create the labels, then exit
 *   npx tsx .sandcastle/main.ts --once      run one pass, then exit
 *   npx tsx .sandcastle/main.ts --issue 42  only act on issue #42
 *   npx tsx .sandcastle/main.ts             poll forever
 */
import {
  LABELS,
  IN_FLIGHT,
  POLL_SECONDS,
  REPO_DIR,
  BASE_BRANCH,
  type StateLabel,
} from './config.ts'
import {
  listAgentIssues,
  listComments,
  addComment,
  setState,
  ensureLabels,
  isBotComment,
  isTrusted,
  allowedAuthors,
  type Issue,
} from './github.ts'
import {
  runPlanner,
  latestPlanComment,
  revisionOf,
  planBodyForImplementer,
} from './plan.ts'
import { implementIssue } from './implement.ts'

const args = process.argv.slice(2)
const flag = (name: string) => args.includes(`--${name}`)
const value = (name: string) => {
  const i = args.indexOf(`--${name}`)
  return i === -1 ? undefined : args[i + 1]
}

const onlyIssue = value('issue') ? Number(value('issue')) : undefined

let stopping = false

const log = (msg: string) => console.log(`[${new Date().toISOString()}] ${msg}`)

const errText = (err: unknown) => (err instanceof Error ? err.message : String(err))

/** Move an issue to the failure sink with an explanation the human can read. */
async function block(issue: Issue, from: StateLabel, reason: string): Promise<void> {
  await addComment(
    issue.number,
    `### ⚠️ Agent pipeline stopped\n\n${reason}\n\nRemove the \`${LABELS.blocked}\` label and add \`${LABELS.queued}\` to start over, or take it from here by hand.`,
  )
  await setState(issue.number, { add: [LABELS.blocked], remove: [from] })
  log(`#${issue.number} → blocked`)
}

// ── Transitions ────────────────────────────────────────────────────────────

async function doPlan(issue: Issue): Promise<void> {
  log(`#${issue.number} planning: ${issue.title}`)
  await setState(issue.number, { add: [LABELS.planning], remove: [LABELS.queued] })
  try {
    const revision = await runPlanner(issue)
    await setState(issue.number, {
      add: [LABELS.needsReview],
      remove: [LABELS.planning],
    })
    log(`#${issue.number} → needs-review (revision ${revision})`)
  } catch (err) {
    await block(issue, LABELS.planning, `The planner failed:\n\n\`\`\`\n${errText(err)}\n\`\`\``)
  }
}

async function doReview(issue: Issue): Promise<void> {
  const comments = await listComments(issue.number)
  const plan = latestPlanComment(comments)

  if (!plan) {
    await block(
      issue,
      LABELS.needsReview,
      'This issue is labelled `agent:needs-review` but no plan comment exists on it.',
    )
    return
  }

  // Approval is a label, not a checkbox: only accounts with Triage+ access on
  // the repo can add labels, whereas GitHub lets any read-access user toggle
  // a checkbox in a comment. Applying `agent:proceed` is the trust boundary.
  if (issue.labels.includes(LABELS.proceed)) {
    log(`#${issue.number} approved via ${LABELS.proceed} (revision ${revisionOf(plan)})`)
    await setState(issue.number, {
      add: [LABELS.approved],
      remove: [LABELS.needsReview, LABELS.proceed],
    })
    return
  }

  // Steering: trusted, human comments posted after the newest plan.
  // Untrusted authors are ignored — this is a public repo, and anyone could
  // otherwise re-trigger the planner by commenting.
  const feedback = comments.filter(
    (c) => new Date(c.createdAt) > new Date(plan.createdAt) && !isBotComment(c) && isTrusted(c),
  )

  const ignored = comments.filter(
    (c) => new Date(c.createdAt) > new Date(plan.createdAt) && !isBotComment(c) && !isTrusted(c),
  )
  for (const c of ignored) {
    log(`#${issue.number} ignoring comment from untrusted author @${c.author}`)
  }

  if (feedback.length === 0) return

  log(`#${issue.number} revising from ${feedback.length} comment(s)`)
  await setState(issue.number, { add: [LABELS.planning], remove: [LABELS.needsReview] })
  try {
    const revision = await runPlanner(issue, {
      previousPlan: planBodyForImplementer(plan),
      feedback: feedback.map((c) => `From @${c.author}:\n${c.body}`).join('\n\n---\n\n'),
      revision: revisionOf(plan),
    })
    await setState(issue.number, { add: [LABELS.needsReview], remove: [LABELS.planning] })
    log(`#${issue.number} → needs-review (revision ${revision})`)
  } catch (err) {
    await block(issue, LABELS.planning, `Replanning failed:\n\n\`\`\`\n${errText(err)}\n\`\`\``)
  }
}

async function doImplement(issue: Issue): Promise<void> {
  const comments = await listComments(issue.number)
  const plan = latestPlanComment(comments)

  if (!plan) {
    await block(
      issue,
      LABELS.approved,
      'This issue is approved but has no plan comment to implement.',
    )
    return
  }

  log(`#${issue.number} implementing (plan revision ${revisionOf(plan)})`)
  await setState(issue.number, { add: [LABELS.implementing], remove: [LABELS.approved] })

  try {
    const result = await implementIssue(issue, planBodyForImplementer(plan))
    if (result.ok) {
      const lintNote = result.lintNote
        ? `\n\n⚠️ ESLint reported problems in the changed files. This did not block the PR (repo lint is already red on \`main\`) but is worth a look — details are in the PR description.`
        : ''
      await addComment(
        issue.number,
        `### ✅ Pull request opened\n\n${result.prUrl}\n\n\`npm run check\` passed on \`agent/issue-${issue.number}\` before it was opened.${lintNote}`,
      )
      await setState(issue.number, { add: [LABELS.done], remove: [LABELS.implementing] })
      log(`#${issue.number} → done: ${result.prUrl}`)
    } else {
      await block(issue, LABELS.implementing, result.failure ?? 'Implementation failed.')
    }
  } catch (err) {
    await block(
      issue,
      LABELS.implementing,
      `The implementation run failed:\n\n\`\`\`\n${errText(err)}\n\`\`\``,
    )
  }
}

// ── Loop ───────────────────────────────────────────────────────────────────

/**
 * An in-flight label at startup means a run died with the process. Put the
 * issue back where it was so the next pass retries it, and say so on the issue
 * rather than silently re-running.
 */
async function reconcile(): Promise<void> {
  const issues = await selectIssues()
  for (const issue of issues) {
    for (const [inflight, previous] of Object.entries(IN_FLIGHT) as [
      StateLabel,
      StateLabel,
    ][]) {
      if (!issue.labels.includes(inflight)) continue
      log(`#${issue.number} was stuck in ${inflight} — resetting to ${previous}`)
      await addComment(
        issue.number,
        `### 🔄 Interrupted run reset\n\nThis issue was left in \`${inflight}\` when the pipeline stopped, so that run did not finish. It has been put back to \`${previous}\` and will be retried.`,
      )
      await setState(issue.number, { add: [previous], remove: [inflight] })
    }
  }
}

/** Logins already warned about, so the loop doesn't repeat itself every poll. */
const warnedAuthors = new Set<number>()

/** Labelled issues, honouring `--issue` so a test run can't disturb others. */
async function selectIssues(): Promise<Issue[]> {
  const { issues, rejected } = await listAgentIssues()

  // Say what was skipped once per issue — a silently ignored labelled issue
  // looks identical to a broken pipeline.
  for (const r of rejected) {
    if (warnedAuthors.has(r.number)) continue
    warnedAuthors.add(r.number)
    log(
      `#${r.number} SKIPPED: opened by @${r.author || '(deleted account)'}, who is not an allowed issue author. ` +
        `Set AGENT_ISSUE_AUTHORS to include them if this is intended.`,
    )
  }

  return onlyIssue === undefined ? issues : issues.filter((i) => i.number === onlyIssue)
}

/** One pass over every labelled issue. At most one transition per issue. */
async function tick(): Promise<void> {
  const issues = await selectIssues()

  for (const issue of issues) {
    if (stopping) return
    const labels = new Set(issue.labels)

    // Terminal and in-flight states need no action.
    if (labels.has(LABELS.done) || labels.has(LABELS.blocked)) continue
    if (labels.has(LABELS.planning) || labels.has(LABELS.implementing)) continue

    try {
      if (labels.has(LABELS.queued)) await doPlan(issue)
      else if (labels.has(LABELS.needsReview)) await doReview(issue)
      else if (labels.has(LABELS.approved)) await doImplement(issue)
    } catch (err) {
      // A transition failed outside its own handler (e.g. the GitHub call that
      // sets the in-flight label). Leave the state alone and retry next pass.
      log(`#${issue.number} pass failed, will retry: ${errText(err)}`)
    }
  }
}

/** Resolves the current sleep() early, set while a sleep is in flight. */
let wakeEarly: (() => void) | undefined

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    const t = setTimeout(() => {
      wakeEarly = undefined
      resolve()
    }, ms)
    wakeEarly = () => {
      clearTimeout(t)
      wakeEarly = undefined
      resolve()
    }
  })

async function main(): Promise<void> {
  if (flag('setup')) {
    log(`Creating pipeline labels on the repo at ${REPO_DIR}`)
    await ensureLabels()
    log('Done. Label an issue `agent:queued` to start.')
    return
  }

  log(`repo=${REPO_DIR} base=${BASE_BRANCH} sandbox=${process.env.AGENT_SANDBOX ?? 'no-sandbox'}`)
  log(`acting only on issues opened by: ${(await allowedAuthors()).join(', ')}`)
  if (onlyIssue !== undefined) log(`restricted to issue #${onlyIssue}`)

  for (const sig of ['SIGINT', 'SIGTERM'] as const) {
    process.on(sig, () => {
      if (stopping) process.exit(130)
      stopping = true
      log(`${sig} received — finishing the current step, press again to force quit`)
      wakeEarly?.()
    })
  }

  await reconcile()

  if (flag('once')) {
    await tick()
    return
  }

  while (!stopping) {
    await tick()
    if (stopping) break
    await sleep(POLL_SECONDS * 1000)
  }
  log('stopped')
}

main().catch((err) => {
  console.error(`fatal: ${errText(err)}`)
  process.exit(1)
})

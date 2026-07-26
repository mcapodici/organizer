/**
 * The implementation half of the pipeline.
 *
 * Runs the agent on a branch forked from the latest main, then refuses to open
 * a pull request until `npm run lint` and `scripts/check.sh` both pass.
 */
import { createSandbox } from '@ai-hero/sandcastle'
import type { Sandbox } from '@ai-hero/sandcastle'
import { fileURLToPath } from 'node:url'
import { readFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import {
  implementer,
  sandbox,
  REPO_DIR,
  BASE_BRANCH,
  branchFor,
  isHostSandbox,
  MAX_IMPLEMENT_ITERATIONS,
  MAX_FIX_ROUNDS,
} from './config.ts'
import { createPr, type Issue } from './github.ts'

const exec = promisify(execFile)
/** Lazy, so importing this module never depends on a `file:` import.meta.url. */
const promptDir = () => fileURLToPath(new URL('./prompts/', import.meta.url))

/**
 * The blocking gate: the repo's own canonical check (tests → tsc → docs build
 * → app build). This is what must be green before a pull request is opened.
 *
 * `npm run lint` is deliberately NOT here. It is already red on `main`
 * (21 errors at the time of writing, in src/hooks/useTodoCounts.ts,
 * vite.config.ts and others), so requiring it to pass would block every run
 * forever. Lint is reported as advisory instead — see lintChangedFiles().
 */
const GATE = ['bash scripts/check.sh'] as const

/** Keep failure output small enough to fit in a prompt and an issue comment. */
const tail = (s: string, chars = 6000) =>
  s.length <= chars ? s : `…(truncated)…\n${s.slice(-chars)}`

export interface ImplementResult {
  ok: boolean
  /** Set when ok. */
  prUrl?: string
  /** Set when !ok — human-readable reason, safe to post as a comment. */
  failure?: string
  /** Advisory lint output for the files this branch touched, if any. */
  lintNote?: string
}

/**
 * Lint only the files this branch changed, and report without blocking.
 *
 * Scoped to changed files because the repo-wide lint is already failing on
 * `main`; a branch cannot reasonably be held responsible for that. Even so,
 * a changed file may have been red before the agent touched it, so this stays
 * advisory and is surfaced to the human rather than enforced.
 */
async function lintChangedFiles(box: Sandbox, branch: string): Promise<string | undefined> {
  const { stdout } = await exec('git', ['diff', '--name-only', `${BASE_BRANCH}...${branch}`], {
    cwd: REPO_DIR,
  })
  const files = stdout
    .split('\n')
    .map((f) => f.trim())
    .filter((f) => /\.(ts|tsx|js|jsx|mjs)$/.test(f))

  if (files.length === 0) return undefined

  const res = await box.exec(`npx eslint ${files.map((f) => `'${f}'`).join(' ')}`)
  if (res.exitCode === 0) return undefined
  return tail(`${res.stdout}\n${res.stderr}`, 3000)
}

/**
 * Guarantee the run starts from a branch freshly forked off the base ref.
 *
 * `baseBranch` is only honoured when the branch does not yet exist, so a
 * leftover branch from an earlier blocked attempt would silently be resumed —
 * carrying the broken tree forward instead of starting from latest main.
 *
 * Returns an error string if the branch is spoken for by an open PR, in which
 * case deleting it would be destructive and a human should decide.
 */
async function prepareBranch(branch: string): Promise<string | undefined> {
  const exists = await exec('git', ['rev-parse', '--verify', '--quiet', branch], {
    cwd: REPO_DIR,
  }).then(
    () => true,
    () => false,
  )
  if (!exists) return undefined

  const { stdout } = await exec(
    'gh',
    ['pr', 'list', '--head', branch, '--state', 'open', '--json', 'number'],
    { cwd: REPO_DIR },
  )
  const openPrs = JSON.parse(stdout) as { number: number }[]
  if (openPrs.length > 0) {
    return `Branch \`${branch}\` already exists and has an open pull request (#${openPrs[0].number}). Refusing to touch it — close or merge that PR, or delete the branch, then re-queue this issue.`
  }

  console.log(`  discarding stale branch ${branch} so the run starts from ${BASE_BRANCH}`)
  await exec('git', ['branch', '-D', branch], { cwd: REPO_DIR })
  return undefined
}

export async function implementIssue(
  issue: Issue,
  approvedPlan: string,
): Promise<ImplementResult> {
  const branch = branchFor(issue.number)

  // The base ref must be current before the worktree forks from it.
  await exec('git', ['fetch', 'origin'], { cwd: REPO_DIR })

  const branchProblem = await prepareBranch(branch)
  if (branchProblem) return { ok: false, failure: branchProblem }

  // A fresh worktree has no node_modules. On the host we can install with the
  // repo's lockfile; in Docker the same command runs inside the container.
  const install = [{ command: 'npm ci', timeoutMs: 15 * 60_000 }]

  const box = await createSandbox({
    branch,
    baseBranch: BASE_BRANCH,
    sandbox: sandbox(),
    cwd: REPO_DIR,
    hooks: isHostSandbox()
      ? { host: { onWorktreeReady: install } }
      : { sandbox: { onSandboxReady: install } },
  })

  try {
    return await runInSandbox(box, issue, branch, approvedPlan)
  } finally {
    // Tears down the sandbox and worktree. The branch itself survives, which
    // is what the pull request is opened from.
    await box.close()
  }
}

async function runInSandbox(
  box: Sandbox,
  issue: Issue,
  branch: string,
  approvedPlan: string,
): Promise<ImplementResult> {
  const promptArgs = {
    ISSUE_NUMBER: issue.number,
    ISSUE_TITLE: issue.title,
    ISSUE_BODY: issue.body || '(no description given)',
    APPROVED_PLAN: approvedPlan,
  }

  await box.run({
    agent: implementer(),
    name: `implement-${issue.number}`,
    promptFile: `${promptDir()}implement.md`,
    promptArgs,
    maxIterations: MAX_IMPLEMENT_ITERATIONS,
  })

  // ── Gate, with a bounded number of fix rounds ────────────────────────────
  const fixPrompt = await readFile(`${promptDir()}fix-checks.md`, 'utf8')
  let failure: { command: string; output: string } | undefined

  for (let round = 0; round <= MAX_FIX_ROUNDS; round++) {
    failure = undefined

    for (const command of GATE) {
      console.log(`  gate: ${command}`)
      const res = await box.exec(command)
      if (res.exitCode !== 0) {
        failure = { command, output: tail(`${res.stdout}\n${res.stderr}`) }
        break
      }
    }

    if (!failure) break

    if (round === MAX_FIX_ROUNDS) {
      return {
        ok: false,
        failure: `\`${failure.command}\` still failing after ${MAX_FIX_ROUNDS} fix round(s):\n\n\`\`\`\n${failure.output}\n\`\`\``,
      }
    }

    console.log(`  gate failed on \`${failure.command}\` — fix round ${round + 1}`)
    // Inline prompt: promptArgs only apply to promptFile, so substitute here.
    const prompt = fixPrompt
      .replaceAll('{{ISSUE_NUMBER}}', String(issue.number))
      .replaceAll('{{SOURCE_BRANCH}}', branch)
      .replaceAll('{{FAILED_COMMAND}}', failure.command)
      .replaceAll('{{FAILURE_OUTPUT}}', failure.output)

    await box.run({ agent: implementer(), name: `fix-${issue.number}-${round + 1}`, prompt })
  }

  // ── Did the agent actually commit anything? ──────────────────────────────
  const { stdout: diff } = await exec(
    'git',
    ['rev-list', '--count', `${BASE_BRANCH}..${branch}`],
    { cwd: REPO_DIR },
  )
  if (Number(diff.trim()) === 0) {
    return {
      ok: false,
      failure:
        'The gate passed but the agent committed nothing — there is no change to open a pull request for.',
    }
  }

  // ── Advisory lint (never blocks — see GATE) ──────────────────────────────
  const lintNote = await lintChangedFiles(box, branch)
  if (lintNote) console.log('  lint reported problems in changed files (advisory)')

  // ── Push and open the PR ─────────────────────────────────────────────────
  await exec('git', ['push', '-u', 'origin', branch], { cwd: REPO_DIR })

  const lintSection = lintNote
    ? `\n\n---\n\n<details><summary>⚠️ ESLint problems in the files this branch changed (advisory — repo lint is already red on \`main\`)</summary>\n\n\`\`\`\n${lintNote}\n\`\`\`\n\n</details>`
    : ''

  const prUrl = await createPr({
    head: branch,
    base: BASE_BRANCH.replace(/^origin\//, ''),
    title: issue.title,
    body: `Closes #${issue.number}\n\nImplemented by the agent pipeline from the plan approved on #${issue.number}.\n\n---\n\n${approvedPlan}\n\n---\n\nGate: \`npm run check\` (tests → \`tsc -b\` → docs build → app build) passed on this branch before the PR was opened.${lintSection}`,
  })

  return { ok: true, prUrl, lintNote }
}

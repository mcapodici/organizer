/**
 * Configuration for the issue-driven agent pipeline.
 *
 * Everything tunable lives here. Sandbox choice is deliberately a single
 * switch so Docker can be adopted later without touching the orchestrator.
 */
import { noSandbox } from '@ai-hero/sandcastle/sandboxes/no-sandbox'
import { docker } from '@ai-hero/sandcastle/sandboxes/docker'
import { claudeCode } from '@ai-hero/sandcastle'
import type { SandboxProvider, AgentProvider, ClaudeCodeOptions } from '@ai-hero/sandcastle'

/** Labels that make up the state machine. Order matters for reconciliation. */
export const LABELS = {
  queued: 'agent:queued',
  planning: 'agent:planning',
  needsReview: 'agent:needs-review',
  approved: 'agent:approved',
  implementing: 'agent:implementing',
  done: 'agent:done',
  blocked: 'agent:blocked',
} as const

export type StateLabel = (typeof LABELS)[keyof typeof LABELS]

export const ALL_LABELS: StateLabel[] = Object.values(LABELS)

/** Colour + description used by `--setup` when creating the labels. */
export const LABEL_META: Record<StateLabel, { color: string; description: string }> = {
  [LABELS.queued]: { color: '1d76db', description: 'Waiting for the agent to draft a plan' },
  [LABELS.planning]: { color: 'c5def5', description: 'Planner is running (in flight)' },
  [LABELS.needsReview]: { color: 'fbca04', description: 'Plan posted — awaiting human approval' },
  [LABELS.approved]: { color: '0e8a16', description: 'Plan approved — implementation queued' },
  [LABELS.implementing]: { color: 'c2e0c6', description: 'Implementation agent is running (in flight)' },
  [LABELS.done]: { color: '5319e7', description: 'Pull request opened' },
  [LABELS.blocked]: { color: 'b60205', description: 'Needs a human — see the issue comments' },
}

/**
 * Labels that mean "a run was in progress". If the orchestrator restarts and
 * finds one of these, the run died with it and must be reconciled back.
 */
export const IN_FLIGHT: Partial<Record<StateLabel, StateLabel>> = {
  [LABELS.planning]: LABELS.queued,
  [LABELS.implementing]: LABELS.approved,
}

/** Markers embedded in comments so the orchestrator can find its own output. */
export const PLAN_MARKER = 'sandcastle:plan'
export const APPROVE_MARKER = 'sandcastle:approve'

/**
 * Stamped on every comment the orchestrator posts. The orchestrator writes as
 * the same GitHub user as the human, so without this its own status comments
 * would be picked up as steering feedback and loop the planner forever.
 */
export const BOT_MARKER = 'sandcastle:bot'

/** Host repo the worktrees are anchored to. Defaults to where the process runs. */
export const REPO_DIR = process.env.AGENT_REPO_DIR ?? process.cwd()

/**
 * Logins whose issues the pipeline is willing to act on.
 *
 * Defaults to just the authenticated `gh` user (resolved at startup). The
 * `agent:*` label already gates admission — only write/triage accounts can
 * apply labels — but that makes *labelling* the security boundary, so a
 * mislabelled third-party issue would feed a stranger's text to the agent.
 * This is the second lock: the issue must also have been opened by you.
 *
 * Set AGENT_ISSUE_AUTHORS to a comma-separated list to widen it.
 */
export const ISSUE_AUTHORS: string[] | undefined = process.env.AGENT_ISSUE_AUTHORS?.split(',')
  .map((s) => s.trim().toLowerCase())
  .filter((s) => s !== '')

/** GitHub logins are case-insensitive, so compare them folded. */
export const isAllowedAuthor = (login: string, allowed: string[]): boolean =>
  allowed.includes(login.toLowerCase())

/** Seconds between polls of the issue list. */
export const POLL_SECONDS = Number(process.env.AGENT_POLL_SECONDS ?? 60)

/** Branch every implementation run forks from. */
export const BASE_BRANCH = process.env.AGENT_BASE_BRANCH ?? 'origin/main'

/** Branch name for an issue's implementation work. */
export const branchFor = (issue: number) => `agent/issue-${issue}`

/** Max agent iterations per implementation run, and how many gate-fix rounds follow. */
export const MAX_IMPLEMENT_ITERATIONS = Number(process.env.AGENT_MAX_ITERATIONS ?? 5)
export const MAX_FIX_ROUNDS = Number(process.env.AGENT_MAX_FIX_ROUNDS ?? 2)

/**
 * `noSandbox()` does not pass `--dangerously-skip-permissions` — sandcastle
 * leaves permission handling to the caller. Unattended runs therefore need an
 * explicit permission mode or the agent blocks forever on the first prompt.
 *
 * `bypassPermissions` matches what scripts/watch-todo.sh already does on this
 * host. Set AGENT_PERMISSION_MODE=auto for AI-mediated per-tool approval.
 */
const PERMISSION_MODE = (process.env.AGENT_PERMISSION_MODE ??
  'bypassPermissions') as NonNullable<ClaudeCodeOptions['permissionMode']>

const MODEL = process.env.AGENT_MODEL ?? 'claude-opus-5'

export const planner = (): AgentProvider =>
  claudeCode(MODEL, { permissionMode: PERMISSION_MODE, effort: 'high' })

export const implementer = (): AgentProvider =>
  claudeCode(MODEL, { permissionMode: PERMISSION_MODE, effort: 'high' })

/**
 * Sandbox selection. `no-sandbox` runs the agent on this host in a git
 * worktree — fast, reuses the existing Claude login, but unisolated.
 * `docker` gives full isolation at the cost of `npm ci` per run.
 */
export function sandbox(): SandboxProvider {
  const choice = process.env.AGENT_SANDBOX ?? 'no-sandbox'
  if (choice === 'docker') return docker()
  if (choice === 'no-sandbox') return noSandbox()
  throw new Error(`Unknown AGENT_SANDBOX: ${choice} (expected "no-sandbox" or "docker")`)
}

/** True when the agent runs on the host and can reuse the repo's node_modules. */
export const isHostSandbox = () => (process.env.AGENT_SANDBOX ?? 'no-sandbox') === 'no-sandbox'

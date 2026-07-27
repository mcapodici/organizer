/**
 * Thin wrappers over the `gh` CLI.
 *
 * All GitHub I/O happens here, on the host. Agents never receive GitHub
 * credentials — issue text and plans reach them through prompt arguments.
 */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import {
  REPO_DIR,
  ALL_LABELS,
  LABEL_META,
  BOT_MARKER,
  ISSUE_AUTHORS,
  isAllowedAuthor,
  type StateLabel,
} from './config.ts'

const exec = promisify(execFile)

/** stdout of a `gh` invocation, or a thrown error carrying stderr. */
async function gh(args: string[], stdin?: string): Promise<string> {
  const pending = exec('gh', args, { cwd: REPO_DIR, maxBuffer: 32 * 1024 * 1024 })
  if (stdin !== undefined) {
    pending.child.stdin?.end(stdin)
  }
  try {
    const { stdout } = await pending
    return stdout
  } catch (err) {
    const e = err as { stderr?: string; message: string }
    throw new Error(`gh ${args.join(' ')} failed: ${e.stderr?.trim() || e.message}`, {
      cause: err,
    })
  }
}

export interface Issue {
  number: number
  title: string
  body: string
  labels: string[]
  author: string
}

/** The login `gh` is authenticated as. Resolved once, then cached. */
let cachedUser: string | undefined
export async function authenticatedUser(): Promise<string> {
  cachedUser ??= (await gh(['api', 'user', '--jq', '.login'])).trim()
  return cachedUser
}

/**
 * Logins whose issues may enter the pipeline: the configured allowlist, or the
 * authenticated user alone when none is configured.
 */
export async function allowedAuthors(): Promise<string[]> {
  return ISSUE_AUTHORS ?? [(await authenticatedUser()).toLowerCase()]
}

export interface Comment {
  id: number
  body: string
  createdAt: string
  author: string
  /** OWNER | MEMBER | COLLABORATOR | CONTRIBUTOR | NONE — see TRUSTED_ASSOCIATIONS. */
  authorAssociation: string
}

/**
 * Only these associations may steer a plan. This repo is public, so without
 * the check any passer-by could re-trigger the planner by commenting.
 */
export const TRUSTED_ASSOCIATIONS = new Set(['OWNER', 'MEMBER', 'COLLABORATOR'])

export const isTrusted = (c: Comment) => TRUSTED_ASSOCIATIONS.has(c.authorAssociation)

/**
 * Open issues carrying at least one `agent:*` label AND opened by an allowed
 * author. Both conditions are required: the label authorises the work, the
 * author check makes sure the text driving the agent is yours.
 *
 * Issues rejected on authorship are returned separately rather than dropped, so
 * the caller can say out loud what it skipped instead of failing silently.
 */
export async function listAgentIssues(): Promise<{ issues: Issue[]; rejected: Issue[] }> {
  const raw = await gh([
    'issue',
    'list',
    '--state',
    'open',
    '--limit',
    '100',
    '--json',
    'number,title,body,labels,author',
  ])
  const parsed = JSON.parse(raw) as {
    number: number
    title: string
    body: string | null
    labels: { name: string }[]
    author: { login: string } | null
  }[]

  const labelled = parsed
    .map((i) => ({
      number: i.number,
      title: i.title,
      body: i.body ?? '',
      labels: i.labels.map((l) => l.name),
      // A null author means a deleted account — treat it as untrusted.
      author: i.author?.login ?? '',
    }))
    .filter((i) => i.labels.some((l) => l.startsWith('agent:')))
    .sort((a, b) => a.number - b.number)

  const allowed = await allowedAuthors()
  return {
    issues: labelled.filter((i) => isAllowedAuthor(i.author, allowed)),
    rejected: labelled.filter((i) => !isAllowedAuthor(i.author, allowed)),
  }
}

/** All comments on an issue, oldest first. */
export async function listComments(issue: number): Promise<Comment[]> {
  const raw = await gh([
    'api',
    '--paginate',
    `repos/{owner}/{repo}/issues/${issue}/comments`,
    '--jq',
    '.[] | {id: .id, body: .body, createdAt: .created_at, author: .user.login, authorAssociation: .author_association}',
  ])
  // --jq with --paginate emits one JSON object per line, not an array.
  return raw
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => JSON.parse(line) as Comment)
}

/**
 * Post a comment as the orchestrator. Always stamped with the bot marker so
 * steering detection can tell the pipeline's own output from a human reply.
 */
export async function addComment(issue: number, body: string): Promise<void> {
  const stamped = body.includes(`<!-- ${BOT_MARKER} -->`)
    ? body
    : `<!-- ${BOT_MARKER} -->\n${body}`
  await gh(['issue', 'comment', String(issue), '--body-file', '-'], stamped)
}

/** True when this comment was written by the pipeline rather than a person. */
export const isBotComment = (c: Comment) => c.body.includes(`<!-- ${BOT_MARKER} -->`)

export async function addLabels(issue: number, labels: StateLabel[]): Promise<void> {
  if (labels.length === 0) return
  await gh(['issue', 'edit', String(issue), ...labels.flatMap((l) => ['--add-label', l])])
}

export async function removeLabels(issue: number, labels: StateLabel[]): Promise<void> {
  if (labels.length === 0) return
  await gh(['issue', 'edit', String(issue), ...labels.flatMap((l) => ['--remove-label', l])])
}

/**
 * Move an issue from one state to another in a single `gh issue edit` call, so
 * the transition cannot be observed half-applied by the next poll.
 */
export async function setState(
  issue: number,
  opts: { add?: StateLabel[]; remove?: StateLabel[] },
): Promise<void> {
  const args = [
    ...(opts.add ?? []).flatMap((l) => ['--add-label', l]),
    ...(opts.remove ?? []).flatMap((l) => ['--remove-label', l]),
  ]
  if (args.length === 0) return
  await gh(['issue', 'edit', String(issue), ...args])
}

/** Returns the URL of the created pull request. */
export async function createPr(opts: {
  head: string
  base: string
  title: string
  body: string
}): Promise<string> {
  const out = await gh([
    'pr',
    'create',
    '--head',
    opts.head,
    '--base',
    opts.base,
    '--title',
    opts.title,
    '--body-file',
    '-',
  ], opts.body)
  return out.trim().split('\n').pop() ?? ''
}

/** Creates any of the pipeline's labels that don't exist yet. Idempotent. */
export async function ensureLabels(): Promise<void> {
  for (const name of ALL_LABELS) {
    const meta = LABEL_META[name]
    // --force makes this an upsert, so re-running --setup refreshes colours.
    await gh([
      'label',
      'create',
      name,
      '--color',
      meta.color,
      '--description',
      meta.description,
      '--force',
    ])
    console.log(`  label ready: ${name}`)
  }
}

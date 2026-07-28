/**
 * PR-steering half of the pipeline: once implementation opens a pull request,
 * this watches it for follow-up feedback from the allowed author and turns
 * that into a pushed revision — general conversation comments and inline,
 * line-anchored review comments both count.
 */
import { PR_ACK_MARKER } from './config.ts'
import type { Comment, ReviewComment } from './github.ts'

/** The newest acknowledgement the orchestrator posted on this PR, if any. */
export function latestAckComment(comments: Comment[]): Comment | undefined {
  return comments.filter((c) => c.body.includes(`<!-- ${PR_ACK_MARKER} -->`)).at(-1)
}

/** Render feedback into a single block: for the implementer prompt and the ack comment alike. */
export function formatFeedback(general: Comment[], review: ReviewComment[]): string {
  const generalText = general.map((c) => `From @${c.author}:\n${c.body}`)
  const reviewText = review.map(
    (c) => `From @${c.author} on \`${c.path}${c.line ? `:${c.line}` : ''}\`:\n${c.body}`,
  )
  return [...generalText, ...reviewText].join('\n\n---\n\n')
}

/** The bot-stamped comment posted back on the PR once a revision is pushed. */
export function renderPrAck(feedback: string, lintNote?: string): string {
  const lintSection = lintNote
    ? `\n\n⚠️ ESLint reported problems in the changed files — see the PR description for details.`
    : ''
  return `<!-- ${PR_ACK_MARKER} -->
### 🔄 Pushed an update addressing this feedback

${feedback}

---

\`npm run check\` passed on this branch before pushing.${lintSection}
`
}

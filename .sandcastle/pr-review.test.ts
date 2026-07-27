import { describe, it, expect } from 'vitest'
import { latestAckComment, formatFeedback, renderPrAck } from './pr-review.ts'
import type { Comment, ReviewComment } from './github.ts'

const comment = (over: Partial<Comment>): Comment => ({
  id: 1,
  body: '',
  createdAt: '2026-07-26T00:00:00Z',
  author: 'mcapodici',
  authorAssociation: 'OWNER',
  ...over,
})

const reviewComment = (over: Partial<ReviewComment>): ReviewComment => ({
  id: 1,
  body: '',
  createdAt: '2026-07-26T00:00:00Z',
  author: 'mcapodici',
  authorAssociation: 'OWNER',
  path: 'src/App.tsx',
  line: 42,
  ...over,
})

describe('latestAckComment', () => {
  it('returns undefined when the pipeline has never replied', () => {
    expect(latestAckComment([comment({ body: 'just a human comment' })])).toBeUndefined()
  })

  it('finds the newest ack, ignoring other chatter', () => {
    const comments = [
      comment({ id: 1, body: renderPrAck('first round') }),
      comment({ id: 2, body: 'a human reply' }),
      comment({ id: 3, body: renderPrAck('second round') }),
    ]
    expect(latestAckComment(comments)?.id).toBe(3)
  })
})

describe('formatFeedback', () => {
  it('renders general comments with their author', () => {
    const text = formatFeedback([comment({ author: 'mcapodici', body: 'please rename this' })], [])
    expect(text).toContain('From @mcapodici:')
    expect(text).toContain('please rename this')
  })

  it('renders inline review comments with file and line', () => {
    const text = formatFeedback(
      [],
      [reviewComment({ author: 'mcapodici', path: 'src/App.tsx', line: 12, body: 'use a const here' })],
    )
    expect(text).toContain('From @mcapodici on `src/App.tsx:12`:')
    expect(text).toContain('use a const here')
  })

  it('omits the line when a review comment has none (outdated by a later push)', () => {
    const text = formatFeedback([], [reviewComment({ path: 'src/App.tsx', line: null })])
    expect(text).toContain('`src/App.tsx`:')
    expect(text).not.toContain('src/App.tsx:')
  })

  it('combines both kinds in one block', () => {
    const text = formatFeedback(
      [comment({ body: 'general point' })],
      [reviewComment({ body: 'inline point' })],
    )
    expect(text).toContain('general point')
    expect(text).toContain('inline point')
  })
})

describe('renderPrAck', () => {
  it('echoes the feedback it addressed', () => {
    const body = renderPrAck('From @mcapodici:\nfix the typo')
    expect(body).toContain('fix the typo')
    expect(body).toContain('npm run check` passed')
  })

  it('notes advisory lint problems when present', () => {
    const body = renderPrAck('feedback text', 'some eslint output')
    expect(body).toContain('ESLint reported problems')
  })

  it('says nothing about lint when there is none', () => {
    const body = renderPrAck('feedback text')
    expect(body).not.toContain('ESLint')
  })
})

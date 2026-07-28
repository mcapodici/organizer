import { describe, it, expect } from 'vitest'
import {
  deCheckbox,
  renderPlan,
  latestPlanComment,
  revisionOf,
  planBodyForImplementer,
  type Plan,
} from './plan.ts'
import type { Comment } from './github.ts'
import { isAllowedAuthor } from './config.ts'

const plan: Plan = {
  summary: 'Add a typecheck script.',
  steps: ['Add the script', 'Document it'],
  filesToChange: ['package.json'],
  assumptions: ['npm is the package manager'],
  openQuestions: [
    { question: 'Which flag?', chosenAnswer: 'tsc -b', rationale: 'matches check.sh' },
  ],
  risks: [],
  testPlan: ['Run npm run check'],
}

const comment = (over: Partial<Comment>): Comment => ({
  id: 1,
  body: '',
  createdAt: '2026-07-26T00:00:00Z',
  author: 'someone',
  authorAssociation: 'OWNER',
  ...over,
})

describe('isAllowedAuthor', () => {
  const allowed = ['mcapodici']

  it('admits an allowed author', () => {
    expect(isAllowedAuthor('mcapodici', allowed)).toBe(true)
  })

  it('is case-insensitive, since GitHub logins are', () => {
    expect(isAllowedAuthor('McApodici', allowed)).toBe(true)
    expect(isAllowedAuthor('MCAPODICI', allowed)).toBe(true)
  })

  it('rejects anyone else', () => {
    expect(isAllowedAuthor('somebody-else', allowed)).toBe(false)
  })

  it('rejects a deleted account (empty login)', () => {
    expect(isAllowedAuthor('', allowed)).toBe(false)
  })

  it('rejects a login that merely contains an allowed one', () => {
    // Guards against substring matching — `mcapodici-evil` is not `mcapodici`.
    expect(isAllowedAuthor('mcapodici-evil', allowed)).toBe(false)
    expect(isAllowedAuthor('notmcapodici', allowed)).toBe(false)
  })

  it('admits nobody when the allowlist is empty', () => {
    expect(isAllowedAuthor('mcapodici', [])).toBe(false)
  })
})

describe('deCheckbox', () => {
  it('turns task-list checkboxes into plain bullets', () => {
    expect(deCheckbox('- [ ] todo')).toBe('- todo')
    expect(deCheckbox('- [x] done')).toBe('- done')
    expect(deCheckbox('* [X] done')).toBe('- done')
  })

  it('preserves indentation so nested lists survive', () => {
    expect(deCheckbox('  - [ ] nested')).toBe('  - nested')
  })

  it('leaves ordinary text and bracketed prose alone', () => {
    expect(deCheckbox('- a normal bullet')).toBe('- a normal bullet')
    expect(deCheckbox('see [x] in the table')).toBe('see [x] in the table')
  })
})

describe('renderPlan', () => {
  it('tells the reviewer to apply the proceed label, with no checkbox', () => {
    const body = renderPlan(42, 1, plan)
    expect(body.match(/^\s*[-*]\s+\[[ xX]\]/gm)).toBeNull()
    expect(body).toContain('agent:proceed')
  })

  it('neutralises checkboxes coming from the agent', () => {
    // A plan about checkbox UI must not smuggle in a clickable box — approval
    // is a label now, so agent-written text must never render as one either.
    const sneaky: Plan = {
      ...plan,
      summary: 'Render todos as:\n- [x] done\n- [ ] pending',
      steps: ['- [x] step one'],
    }
    const body = renderPlan(42, 1, sneaky)
    expect(body.match(/^\s*[-*]\s+\[[ xX]\]/gm)).toBeNull()
  })

  it('records the issue number and revision for later lookup', () => {
    const body = renderPlan(42, 3, plan)
    expect(body).toContain('issue=42')
    expect(revisionOf(comment({ body }))).toBe(3)
  })

  it('surfaces the guess made for each open question', () => {
    const body = renderPlan(42, 1, plan)
    expect(body).toContain('Which flag?')
    expect(body).toContain('Chose: tsc -b')
  })

  it('says so explicitly when nothing was ambiguous', () => {
    const body = renderPlan(42, 1, { ...plan, openQuestions: [] })
    expect(body).toContain('None — the issue was unambiguous.')
  })
})

describe('latestPlanComment', () => {
  it('returns the newest plan comment, ignoring other chatter', () => {
    const comments = [
      comment({ id: 1, body: renderPlan(42, 1, plan) }),
      comment({ id: 2, body: 'a human reply' }),
      comment({ id: 3, body: renderPlan(42, 2, plan) }),
      comment({ id: 4, body: 'another human reply' }),
    ]
    const found = latestPlanComment(comments)
    expect(found?.id).toBe(3)
    expect(revisionOf(found!)).toBe(2)
  })

  it('returns undefined when no plan has been posted', () => {
    expect(latestPlanComment([comment({ body: 'just talking' })])).toBeUndefined()
  })
})

describe('planBodyForImplementer', () => {
  it('keeps the plan and drops the human-instructions footer', () => {
    const body = planBodyForImplementer(comment({ body: renderPlan(42, 1, plan) }))
    expect(body).toContain('### Plan for #42')
    expect(body).toContain('Add the script')
    expect(body).not.toContain('agent:proceed')
    expect(body).not.toContain('sandcastle:footer')
  })
})

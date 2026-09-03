import { describe, expect, it } from 'vitest'
import { deriveExcerpt } from '../src/content/excerpt.ts'

describe('deriveExcerpt', () => {
  it('takes the first prose paragraph', () => {
    expect(deriveExcerpt('# Title\n\nFirst para.\n\nSecond para.\n')).toBe('First para.')
  })

  it('skips fenced code', () => {
    expect(deriveExcerpt('```js\nconst a = 1\n```\n\nReal text.\n')).toBe('Real text.')
  })

  it('strips inline markup and images, collapsing the gap left behind', () => {
    expect(deriveExcerpt('A *bold* [link](x) and ![img](y) here.\n')).toBe('A bold link and here.')
  })

  // 160 chars lands mid-word here
  it('truncates at a word boundary with an ellipsis', () => {
    expect(deriveExcerpt('alpha '.repeat(100)).endsWith('alpha…')).toBe(true)
  })

  it('hard-cuts CJK, which has no spaces to break on', () => {
    expect(deriveExcerpt('文'.repeat(500))).toBe(`${'文'.repeat(160)}…`)
  })

  it('returns empty for a body with no prose', () => {
    expect(deriveExcerpt('# Only a heading\n')).toBe('')
  })
})

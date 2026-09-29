import { describe, expect, it } from 'vitest'
import { deriveExcerpt } from '../src/content/excerpt.ts'

describe('deriveExcerpt', () => {
  it('takes the first paragraph of prose, as plain text', () => {
    const body = '# Title\n\n```js\nconst a = 1\n```\n\nA *bold* [link](x) and ![img](y) here.\n\nSecond para.\n'

    expect(deriveExcerpt(body)).toBe('A bold link and here.')
  })

  it('cuts at a word boundary, or anywhere in CJK, which has no spaces to break on', () => {
    expect(deriveExcerpt('alpha '.repeat(100)).endsWith('alpha…')).toBe(true)
    expect(deriveExcerpt('文'.repeat(500))).toBe(`${'文'.repeat(160)}…`)
  })
})

import { describe, expect, it } from 'vitest'
import { parseFrontMatter, stringifyFrontMatter } from '../src/content/frontmatter.ts'

describe('front matter', () => {
  it('is read with the CRLF endings and the BOM a Windows editor writes', () => {
    const document = parseFrontMatter('\uFEFF---\r\ntitle: Hello\r\n---\r\n\r\nBody.\r\n')

    expect(document.data).toEqual({ title: 'Hello' })
    expect(document.body).toBe('Body.\r\n')
  })

  it('is read back unchanged from what it writes', () => {
    const data = { title: '第一篇文章', tags: ['随笔', '测试'], created: '2026-09-02T10:00:00+08:00', hidden: true }
    const decoded = parseFrontMatter(stringifyFrontMatter(data, 'Body.\n'))

    expect(decoded.data).toEqual(data)
    expect(decoded.body).toBe('Body.\n')
  })
})

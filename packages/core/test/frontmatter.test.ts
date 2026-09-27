import { describe, expect, it } from 'vitest'
import { parseFrontMatter, stringifyFrontMatter } from '../src/content/frontmatter.ts'

describe('parseFrontMatter', () => {
  it('reads a mapping and the body', () => {
    const document = parseFrontMatter('---\ntitle: Hello\ntags: [a, b]\n---\n\nBody text.\n')
    expect(document.data).toEqual({ title: 'Hello', tags: ['a', 'b'] })
    expect(document.body).toBe('Body text.\n')
  })

  it('treats a document without front matter as pure body', () => {
    const document = parseFrontMatter('# Just markdown\n')
    expect(document.data).toEqual({})
    expect(document.body).toBe('# Just markdown\n')
  })

  it('handles CRLF line endings', () => {
    const document = parseFrontMatter('---\r\ntitle: Hello\r\n---\r\n\r\nBody.\r\n')
    expect(document.data).toEqual({ title: 'Hello' })
    expect(document.body).toBe('Body.\r\n')
  })

  it('skips a UTF-8 BOM', () => {
    expect(parseFrontMatter('\uFEFF---\ntitle: Hello\n---\n\nBody.\n').data).toEqual({ title: 'Hello' })
  })

  it('keeps an empty block empty rather than failing', () => {
    expect(parseFrontMatter('---\n---\n\nBody.\n').data).toEqual({})
  })

  it('rejects an unterminated block', () => {
    expect(() => parseFrontMatter('---\ntitle: Hello\n\nBody.\n')).toThrow(/never closed/)
  })

  it('rejects a non-mapping block', () => {
    expect(() => parseFrontMatter('---\n- one\n- two\n---\n\nBody.\n')).toThrow(/mapping/)
  })

  it('rejects invalid YAML', () => {
    expect(() => parseFrontMatter('---\ntitle: "unclosed\n---\n\nBody.\n')).toThrow(/Invalid YAML/)
  })
})

describe('stringifyFrontMatter', () => {
  it('writes what parseFrontMatter reads back unchanged', () => {
    const data = { title: '第一篇文章', tags: ['随笔', '测试'], created: '2026-09-02T10:00:00+08:00', hidden: true }
    const decoded = parseFrontMatter(stringifyFrontMatter(data, 'Body.\n'))

    expect(decoded.data).toEqual(data)
    expect(decoded.body).toBe('Body.\n')
  })
})

import { describe, expect, it } from 'vitest'
import { parseFrontMatter, stringifyFrontMatter } from '../src/content/frontmatter.ts'
import { FrontMatterError, stripFrontMatter } from '../src/content/frontmatterSplit.ts'

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
    expect(parseFrontMatter('﻿---\ntitle: Hello\n---\n\nBody.\n').data).toEqual({ title: 'Hello' })
  })

  it('keeps an empty block empty rather than failing', () => {
    expect(parseFrontMatter('---\n---\n\nBody.\n').data).toEqual({})
  })

  it('rejects an unterminated block', () => {
    expect(() => parseFrontMatter('---\ntitle: Hello\n\nBody.\n')).toThrow(FrontMatterError)
  })

  it('rejects a non-mapping block', () => {
    expect(() => parseFrontMatter('---\n- one\n- two\n---\n\nBody.\n')).toThrow(FrontMatterError)
  })

  it('rejects invalid YAML', () => {
    expect(() => parseFrontMatter('---\ntitle: "unclosed\n---\n\nBody.\n')).toThrow(FrontMatterError)
  })

  // YAML 1.2 has no timestamp type, so TimestampSchema is the only place that interprets this
  it('leaves an ISO timestamp as a string rather than a Date', () => {
    const document = parseFrontMatter('---\ncreated: 2026-09-02T10:00:00+08:00\n---\n\nBody.\n')
    expect(document.data).toEqual({ created: '2026-09-02T10:00:00+08:00' })
  })
})

describe('round trip', () => {
  const cases: readonly Record<string, unknown>[] = [
    { title: 'Hello' },
    { title: '第一篇文章', tags: ['随笔', '测试'], pinned: false, hidden: true },
    { title: 'Edge', created: '2026-09-02T10:00:00+08:00', nested: { a: 1, b: [1, 2] } },
    { title: 'Unknown keys', somethingCustom: 'kept', another: 42 },
  ]

  for (const data of cases) {
    it(`decode(encode(${JSON.stringify(data).slice(0, 40)})) is identity`, () => {
      const decoded = parseFrontMatter(stringifyFrontMatter(data, 'Body.\n'))
      expect(decoded.data).toEqual(data)
      expect(decoded.body).toBe('Body.\n')
    })
  }

  it('emits no delimiters for empty data', () => {
    expect(stringifyFrontMatter({}, 'Body.\n')).toBe('Body.\n')
  })
})

describe('stripFrontMatter', () => {
  it('drops the block for the runtime, which only needs the body', () => {
    expect(stripFrontMatter('---\ntitle: Hello\n---\n\n# Heading\n')).toBe('# Heading\n')
  })
})

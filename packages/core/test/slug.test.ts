import { describe, expect, it } from 'vitest'
import { isValidSlug, slugify } from '../src/content/slug.ts'

describe('slugify', () => {
  it('keeps case and CJK, and drops what a URL segment or a visible file name cannot hold', () => {
    expect(['Hello World', '第一篇文章', 'a/b?c#d', '...dots...'].map(slugify)).toEqual([
      'Hello-World',
      '第一篇文章',
      'abcd',
      'dots',
    ])
  })

  it('makes only slugs it accepts', () => {
    for (const input of ['Hello World', '第一篇文章', 'a/b?c#d', 'Ünicode'])
      expect(isValidSlug(slugify(input))).toBe(true)
  })
})

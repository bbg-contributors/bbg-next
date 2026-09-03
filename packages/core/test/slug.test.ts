import { describe, expect, it } from 'vitest'
import { isValidSlug, slugFromFilename, slugify } from '../src/content/slug.ts'

describe('slugify', () => {
  it.each([
    // case is preserved
    ['Hello World', 'Hello-World'],
    ['第一篇文章', '第一篇文章'],
    ['  spaced  out  ', 'spaced-out'],
    ['a/b?c#d', 'abcd'],
    ['...dots...', 'dots'],
    ['a---b', 'a-b'],
  ])('%s -> %s', (input, expected) => {
    expect(slugify(input)).toBe(expected)
  })

  it('accepts what it produces', () => {
    for (const input of ['Hello World', '第一篇文章', 'a/b?c#d', 'Ünicode']) {
      expect(isValidSlug(slugify(input))).toBe(true)
    }
  })

  it('rejects path separators and empties', () => {
    expect(isValidSlug('a/b')).toBe(false)
    expect(isValidSlug('')).toBe(false)
    expect(isValidSlug('.hidden')).toBe(false)
  })
})

describe('slugFromFilename', () => {
  it('drops the .md suffix and keeps CJK', () => {
    expect(slugFromFilename('第一篇文章.md')).toBe('第一篇文章')
    expect(slugFromFilename('hello.md')).toBe('hello')
  })
})

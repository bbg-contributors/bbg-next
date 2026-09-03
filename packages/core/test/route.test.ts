import type { Route, RouterConfig } from '../src/route.ts'
import { describe, expect, it } from 'vitest'
import { normaliseBase, parse, serialize } from '../src/route.ts'

const hash: RouterConfig = { mode: 'hash', base: '/' }
const pathRoot: RouterConfig = { mode: 'path', base: '/' }
const pathSub: RouterConfig = { mode: 'path', base: '/my-blog/' }

const routes: readonly Route[] = [
  { type: 'home', page: 1 },
  { type: 'home', page: 2 },
  { type: 'home', page: 137 },
  { type: 'article', slug: 'hello' },
  { type: 'article', slug: '第一篇文章' },
  { type: 'article', slug: 'Ünicode-ページ' },
  { type: 'page', slug: 'about' },
  { type: 'page', slug: '关于' },
  // why pagination uses `list` and pages use `page`
  { type: 'page', slug: '2' },
]

function locate(href: string, config: RouterConfig): URL {
  const document = config.mode === 'hash' ? 'http://example.com/' : `http://example.com${normaliseBase(config.base)}`

  return new URL(href, document)
}

describe('route symmetry', () => {
  for (const config of [hash, pathRoot, pathSub]) {
    const label = `${config.mode}@${config.base}`

    for (const route of routes) {
      it(`${label} round-trips ${JSON.stringify(route)}`, () => {
        const href = serialize(route, config)
        expect(parse(locate(href, config), config)).toEqual(route)
      })
    }
  }
})

describe('hash mode', () => {
  it('produces document-relative hrefs', () => {
    expect(serialize({ type: 'article', slug: 'hello' }, hash)).toBe('#/post/hello')
    expect(serialize({ type: 'home', page: 1 }, hash)).toBe('#/')
    expect(serialize({ type: 'home', page: 3 }, hash)).toBe('#/list/3')
  })

  it('percent-encodes CJK slugs', () => {
    expect(serialize({ type: 'article', slug: '第一篇文章' }, hash)).toBe(`#/post/${encodeURIComponent('第一篇文章')}`)
  })

  it('ignores the pathname entirely', () => {
    const url = new URL('http://example.com/anywhere/at/all#/post/hello')
    expect(parse(url, hash)).toEqual({ type: 'article', slug: 'hello' })
  })
})

describe('path mode', () => {
  it('produces trailing-slash hrefs under the base', () => {
    expect(serialize({ type: 'article', slug: 'hello' }, pathSub)).toBe('/my-blog/post/hello/')
    expect(serialize({ type: 'home', page: 1 }, pathSub)).toBe('/my-blog/')
  })

  it('rejects URLs outside the base', () => {
    expect(parse(new URL('http://example.com/other/post/hello/'), pathSub)).toBeNull()
  })

  it('accepts a missing trailing slash', () => {
    expect(parse(new URL('http://example.com/my-blog/post/hello'), pathSub)).toEqual({
      type: 'article',
      slug: 'hello',
    })
  })

  it('splits before decoding, so an encoded slash stays inside one segment', () => {
    const url = new URL(`http://example.com/post/${encodeURIComponent('a/b')}/`)
    expect(parse(url, pathRoot)).toEqual({ type: 'article', slug: 'a/b' })
  })
})

describe('rejections', () => {
  it.each([
    ['#/post/', 'empty slug'],
    ['#/list/0', 'page zero'],
    ['#/list/01', 'leading zero'],
    ['#/list/-1', 'negative page'],
    ['#/list/1.5', 'fractional page'],
    ['#/nope/x', 'unknown prefix'],
    ['#/post/a/b', 'too many segments'],
  ])('rejects %s (%s)', href => {
    expect(parse(new URL(href, 'http://example.com/'), hash)).toBeNull()
  })

  it('rejects malformed percent-encoding instead of throwing', () => {
    expect(parse(new URL('http://example.com/#/post/%E0%A4%A'), hash)).toBeNull()
  })
})

describe('normaliseBase', () => {
  it.each([
    ['', '/'],
    ['/', '/'],
    ['repo', '/repo/'],
    ['/repo', '/repo/'],
    ['/repo/', '/repo/'],
  ])('%s -> %s', (input, expected) => {
    expect(normaliseBase(input)).toBe(expected)
  })
})

import type { Route, RouterConfig } from '../src/route.ts'
import { describe, expect, it } from 'vitest'
import { normaliseBase, parse, parseFragment, resolveDeepLink, serialize } from '../src/route.ts'

const hash: RouterConfig = { mode: 'hash', base: '/' }
const pathRoot: RouterConfig = { mode: 'path', base: '/' }
const pathSub: RouterConfig = { mode: 'path', base: '/my-blog/' }
// As the runtime reads it off the document, encoded.
const pathCjk: RouterConfig = { mode: 'path', base: new URL('./', 'http://example.com/博客/').pathname }

const routes: readonly Route[] = [
  { type: 'home', page: 1 },
  { type: 'home', page: 2 },
  { type: 'article', slug: '第一篇文章' },
  // why pagination uses `list` and pages use `page`
  { type: 'page', slug: '2' },
  { type: 'archive' },
  // a tag is free text, so it may carry what a slug never can
  { type: 'tag', tag: 'C# / .NET?' },
]

function locate(href: string, config: RouterConfig): URL {
  const document = config.mode === 'hash' ? 'http://example.com/' : `http://example.com${normaliseBase(config.base)}`

  return new URL(href, document)
}

describe('route symmetry', () => {
  it.each([hash, pathRoot, pathSub, pathCjk])('round-trips every route in $mode mode at $base', config => {
    for (const route of routes) {
      for (const fragment of ['', '第一节-intro']) {
        const url = locate(serialize(route, config, fragment), config)
        expect(parse(url, config)).toEqual(route)
        expect(parseFragment(url, config)).toBe(fragment)
      }
    }
  })
})

describe('fragments', () => {
  it('follow a second # in hash mode, since the first belongs to the route', () => {
    expect(serialize({ type: 'article', slug: 'hello' }, hash, 'intro')).toBe('#/post/hello#intro')
  })

  it('are the URL’s own in path mode', () => {
    expect(serialize({ type: 'article', slug: 'hello' }, pathSub, 'intro')).toBe('/my-blog/post/hello/#intro')
  })

  it('come back empty from malformed percent-encoding instead of throwing', () => {
    const url = new URL('http://example.com/#/post/hello#%E0%A4%A')
    expect(parse(url, hash)).toEqual({ type: 'article', slug: 'hello' })
    expect(parseFragment(url, hash)).toBe('')
  })
})

describe('hash mode', () => {
  it('produces document-relative hrefs', () => {
    expect(serialize({ type: 'article', slug: 'hello' }, hash)).toBe('#/post/hello')
    expect(serialize({ type: 'home', page: 1 }, hash)).toBe('#/')
    expect(serialize({ type: 'home', page: 3 }, hash)).toBe('#/list/3')
    expect(serialize({ type: 'archive' }, hash)).toBe('#/archive')
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

describe('deep links in hash mode', () => {
  const blog: RouterConfig = { mode: 'hash', base: '/blog/' }

  function follow(href: string): URL {
    const url = new URL(href, 'http://example.com/')
    const resolved = resolveDeepLink(url, blog)
    if (resolved === null) throw new Error(`${href} is no deep link`)

    return new URL(resolved, url)
  }

  it('lead from the path of a route to that route, keeping the fragment', () => {
    // The first page of the list is the root itself.
    for (const route of routes.filter(item => serialize(item, pathRoot) !== '/')) {
      const url = follow(`/blog${serialize(route, pathRoot)}#c1`)

      expect(url.pathname).toBe('/blog/')
      expect(parse(url, blog)).toEqual(route)
      expect(parseFragment(url, blog)).toBe('c1')
    }
  })

  it('leave the root, the document itself and anything outside the site alone', () => {
    for (const href of ['/blog/', '/blog/index.html#/post/hello', '/other/post/hello/']) {
      expect(resolveDeepLink(new URL(href, 'http://example.com/'), blog)).toBeNull()
    }
  })

  it('have nothing to do in path mode, where the path is the route already', () => {
    expect(resolveDeepLink(new URL('http://example.com/post/hello/'), pathRoot)).toBeNull()
  })
})

describe('rejections', () => {
  it.each([
    ['#/post/', 'empty slug'],
    ['#/list/0', 'page zero'],
    ['#/list/01', 'leading zero'],
    ['#/nope/x', 'unknown prefix'],
    ['#/post/a/b', 'too many segments'],
    ['#/tag', 'tag without a name'],
    ['#/archive/2', 'archive with a page'],
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
  ])('%s -> %s', (input, expected) => {
    expect(normaliseBase(input)).toBe(expected)
  })
})

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

describe('routes', () => {
  it.each([hash, pathRoot, pathCjk])('round-trip, fragment and all, in $mode mode at $base', config => {
    for (const route of routes) {
      for (const fragment of ['', '第一节-intro']) {
        const url = locate(serialize(route, config, fragment), config)
        expect(parse(url, config)).toEqual(route)
        expect(parseFragment(url, config)).toBe(fragment)
      }
    }
  })

  it('are written relative to the document in hash mode, and under the base with a trailing slash in path mode', () => {
    expect(routes.map(route => serialize(route, hash))).toEqual([
      '#/',
      '#/list/2',
      `#/article/${encodeURIComponent('第一篇文章')}`,
      '#/page/2',
      '#/archive',
      `#/tag/${encodeURIComponent('C# / .NET?')}`,
    ])
    expect(serialize({ type: 'article', slug: 'hello' }, pathSub)).toBe('/my-blog/article/hello/')
    expect(serialize({ type: 'home', page: 1 }, pathSub)).toBe('/my-blog/')
  })

  it('take the fragment after a second # in hash mode, since the first belongs to the route', () => {
    expect(serialize({ type: 'article', slug: 'hello' }, hash, 'intro')).toBe('#/article/hello#intro')
    expect(serialize({ type: 'article', slug: 'hello' }, pathSub, 'intro')).toBe('/my-blog/article/hello/#intro')
  })

  it('ignore the pathname in hash mode, so the site works under any path', () => {
    expect(parse(new URL('http://example.com/anywhere/at/all#/article/hello'), hash)).toEqual({
      type: 'article',
      slug: 'hello',
    })
  })

  it('read the root’s index.html as the root in path mode, as a host serves it', () => {
    expect(parse(new URL('http://example.com/my-blog/index.html'), pathSub)).toEqual({ type: 'home', page: 1 })
  })

  it('split before decoding, so an encoded slash stays inside one segment', () => {
    const url = new URL(`http://example.com/article/${encodeURIComponent('a/b')}/`)

    expect(parse(url, pathRoot)).toEqual({ type: 'article', slug: 'a/b' })
  })

  it('have one address per list page, so page zero and a leading zero are none', () => {
    for (const href of ['#/list/0', '#/list/01']) expect(parse(new URL(href, 'http://example.com/'), hash)).toBeNull()
  })

  it('come to nothing from malformed percent-encoding, rather than throwing', () => {
    const route = new URL('http://example.com/#/article/%E0%A4%A')
    const fragment = new URL('http://example.com/#/article/hello#%E0%A4%A')

    expect(parse(route, hash)).toBeNull()
    expect(parse(fragment, hash)).toEqual({ type: 'article', slug: 'hello' })
    expect(parseFragment(fragment, hash)).toBe('')
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
    for (const href of ['/blog/', '/blog/index.html#/article/hello', '/other/article/hello/']) {
      expect(resolveDeepLink(new URL(href, 'http://example.com/'), blog)).toBeNull()
    }
  })
})

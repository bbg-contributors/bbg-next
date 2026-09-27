// @vitest-environment happy-dom
import type { PluginContext, SiteSettings } from '@bbg-next/plugin'
import { afterEach, describe, expect, it } from 'vitest'
import { setup } from '../src/index.ts'

const hash: SiteSettings['router'] = { mode: 'hash', base: '/' }

/** Opens `path` on the test origin and returns where the plugin left the address. */
function land(path: string, router = hash): string {
  history.replaceState(null, '', location.origin + path)
  // Only what it reads.
  const context = {
    options: { friends: 'links' },
    site: { router },
    articles: [
      { file: 'my post.md', slug: 'my-post' },
      { file: 'C++.md', slug: 'cpp' },
    ],
    hidden: [{ file: 'secret.md', slug: 'secret' }],
    pages: [{ file: 'Q3xkP7mWc2Rt.md', slug: 'about' }],
  }
  setup(context as unknown as PluginContext)

  return location.href.slice(location.origin.length)
}

const tag = encodeURIComponent('随笔')

describe('an old link', () => {
  afterEach(() => {
    document.querySelector('base')?.remove()
    history.replaceState(null, '', '/')
  })

  it.each([
    // escaped twice, as the original's own links to an article were
    ['/index.html?type=article&filename=my%2520post.md', '/index.html#/post/my-post'],
    ['/index.html?type=article&filename=C++.md', '/index.html#/post/cpp'],
    ['/?type=article&filename=secret.md', '/#/post/secret'],
    ['/index.html?type=article&filename=gone.md', '/index.html#/post/gone'],
    ['/index.html?type=page&filename=Q3xkP7mWc2Rt.md', '/index.html#/page/about'],
    [`/index.html?type=internal&function=tag&argument=${tag}`, `/index.html#/tag/${tag}`],
    ['/index.html?type=internal&function=archive_and_tags', '/index.html#/archive'],
    ['/index.html?type=internal&function=friendbook', '/index.html#/page/links'],
    ['/index.html?type=internal&function=article_list', '/index.html#/'],
    ['/index.html?page_id=2', '/index.html#/'],
    ['//index.html?type=article&filename=secret.md', '/index.html#/post/secret'],
  ])('%s lands on %s', (from, to) => {
    expect(land(from)).toBe(to)
  })

  it('lands on the path in path mode', () => {
    document.head.append(Object.assign(document.createElement('base'), { href: '/blog/' }))

    expect(land('/blog/index.html?type=article&filename=my%2520post.md', { mode: 'path', base: '/blog/' })).toBe(
      '/blog/post/my-post/',
    )
  })

  it('leaves any other address alone', () => {
    expect(land('/?utm_source=feed#/post/a')).toBe('/?utm_source=feed#/post/a')
  })
})

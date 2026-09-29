import type { PluginContext, Redirect, Route } from '@bbg-next/plugin'
import { describe, expect, it } from 'vitest'
import { setup } from '../src/index.ts'

/** The route the plugin gives `path` on a site's origin, as the runtime asks it. */
function redirect(path: string): Route | null {
  let registered: Redirect = () => null
  // Only what it reads.
  const context = {
    options: { friends: 'links' },
    articles: [
      { file: 'my article.md', slug: 'my-article' },
      { file: 'C++.md', slug: 'cpp' },
    ],
    hidden: [{ file: 'secret.md', slug: 'secret' }],
    registerRedirect: (given: Redirect) => void (registered = given),
  }
  setup(context as unknown as PluginContext)

  return registered(new URL(`http://localhost:3000${path}`))
}

describe('an old link', () => {
  it.each([
    // escaped twice, as the original's own links to an article were
    ['/index.html?type=article&filename=my%2520article.md', { type: 'article', slug: 'my-article' }],
    ['/index.html?type=article&filename=C++.md', { type: 'article', slug: 'cpp' }],
    ['/?type=article&filename=secret.md', { type: 'article', slug: 'secret' }],
    ['/index.html?type=article&filename=gone.md', { type: 'article', slug: 'gone' }],
    ['/index.html?type=internal&function=friendbook', { type: 'page', slug: 'links' }],
    ['/index.html?page_id=2', { type: 'home', page: 1 }],
  ])('%s leads to %o', (path, route) => {
    expect(redirect(path)).toEqual(route)
  })

  it('leaves any other address alone', () => {
    expect(redirect('/?utm_source=feed#/article/a')).toBeNull()
  })
})

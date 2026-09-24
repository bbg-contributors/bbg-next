// @vitest-environment happy-dom
import type { RendererRegistry } from '../src/plugins.ts'
import type { Manifest, Route } from '@bbg-next/core'
import { describe, expect, it } from 'vitest'
import { createSite } from '../src/site.ts'

const plain = (source: string): string => source
const renderers: RendererRegistry = { markdown: plain, for: () => plain }

const manifest: Manifest = {
  schemaVersion: 1,
  site: {
    title: 'Test',
    description: '',
    lang: 'en',
    footer: '',
    theme: 'default-theme',
    postsPerPage: 10,
    router: { mode: 'hash', base: '/' },
    plugins: [],
  },
  theme: { name: 'default-theme', version: '1.0.0' },
  plugins: [],
  articles: [],
  hidden: [],
  pages: [
    { slug: 'about', file: 'about.md', title: 'About', updated: 1, showInNav: true, navLabel: 'About', comments: true },
    { slug: 'links', file: 'links.md', title: 'Links', updated: 1, showInNav: true, navLabel: 'Links', comments: true },
    {
      slug: 'secret',
      file: 'secret.md',
      title: 'Secret',
      updated: 1,
      showInNav: false,
      navLabel: 'Secret',
      comments: true,
    },
  ],
}

describe('the shell for a route', () => {
  const site = createSite(manifest, renderers)

  function marks(route: Route | null): { home: boolean; archive: boolean; links: boolean[] } {
    const shell = site.shell(route)

    return { home: shell.home.current, archive: shell.archive.current, links: shell.links.map(link => link.current) }
  }

  it('marks the list on any of its pages, not only the first', () => {
    expect(marks({ type: 'home', page: 2 })).toEqual({ home: true, archive: false, links: [false, false] })
  })

  it('marks the archive on a tag’s page too', () => {
    for (const route of [{ type: 'archive' }, { type: 'tag', tag: 'x' }] as const) {
      expect(marks(route)).toEqual({ home: false, archive: true, links: [false, false] })
    }
  })

  it('marks the page on screen and nothing else', () => {
    expect(marks({ type: 'page', slug: 'links' })).toEqual({ home: false, archive: false, links: [false, true] })
  })

  it('marks nothing for an article, a page kept out of the nav, or a route that led nowhere', () => {
    const routes: (Route | null)[] = [{ type: 'article', slug: 'about' }, { type: 'page', slug: 'secret' }, null]

    for (const route of routes) expect(marks(route)).toEqual({ home: false, archive: false, links: [false, false] })
  })
})

// @vitest-environment happy-dom
import type { RendererRegistry } from '../src/plugins.ts'
import type { ArticleEntry, Manifest } from '@bbg-next/core'
import { describe, expect, it } from 'vitest'
import { createSite } from '../src/site.ts'

const plain = (source: string): string => source
const renderers: RendererRegistry = { markdown: plain, for: () => plain }

function entry(slug: string, created: number, pinned = false): ArticleEntry {
  return {
    slug,
    file: `${slug}.md`,
    title: slug,
    tags: [],
    created,
    updated: created,
    pinned,
    excerpt: '',
    comments: true,
  }
}

const manifest: Manifest = {
  schemaVersion: 1,
  site: {
    title: 'Test',
    description: '',
    lang: 'en',
    footer: '',
    theme: 'default-theme',
    articlesPerPage: 10,
    router: { mode: 'hash', base: '/' },
    url: '',
    atom: false,
    sitemap: false,
    plugins: [],
  },
  theme: { name: 'default-theme', version: '1.0.0', hasConfig: false },
  plugins: [],
  articles: [entry('old', 1, true), entry('new', 3), entry('mid', 2)],
  hidden: [],
  pages: [],
}

describe('the site', () => {
  const site = createSite(manifest, renderers, [])

  it('marks the list in the shell on any of its pages, not only the first', () => {
    expect(site.shell({ type: 'home', page: 2 }).home.current).toBe(true)
  })

  it('keeps a timeline newest first, pinning aside', () => {
    expect(site.timeline.map(item => item.slug)).toEqual(['new', 'mid', 'old'])
  })
})

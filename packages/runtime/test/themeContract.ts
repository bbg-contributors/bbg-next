import type { Manifest } from '@bbg-next/core'
import type { ThemeModule } from '@bbg-next/view'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { start } from '../src/boot.ts'

// Every theme must pass this unchanged. Wiring only: happy-dom has no layout, so looks still need a browser.

const origin = 'http://localhost:3000'

const manifest: Manifest = {
  schemaVersion: 1,
  site: {
    title: '我的博客',
    description: 'A test blog',
    lang: 'zh-CN',
    footer: '© 2026 **me**',
    theme: 'default-theme',
    postsPerPage: 2,
    router: { mode: 'hash', base: '/' },
  },
  articles: [
    {
      slug: 'first',
      file: 'first.md',
      title: '第一篇文章',
      tags: ['随笔'],
      created: 3,
      updated: 3,
      pinned: false,
      excerpt: 'Excerpt one',
    },
    {
      slug: 'second',
      file: 'second.md',
      title: 'Second',
      tags: [],
      created: 2,
      updated: 2,
      pinned: false,
      excerpt: 'Excerpt two',
    },
    {
      slug: 'third',
      file: 'third.md',
      title: 'Third',
      tags: [],
      created: 1,
      updated: 1,
      pinned: false,
      excerpt: 'Excerpt three',
    },
  ],
  hidden: [
    {
      slug: 'secret',
      file: 'secret.md',
      title: '神秘的文章',
      tags: [],
      created: 1,
      updated: 1,
      pinned: false,
      excerpt: 'Shh',
    },
  ],
  pages: [{ slug: 'about', file: 'about.md', title: 'About', updated: 1, showInNav: true, navLabel: 'About' }],
}

const files: Readonly<Record<string, string>> = {
  '/data/site.json': JSON.stringify(manifest),
  '/data/articles/first.md': '---\ntitle: 第一篇文章\n---\n\n# Heading\n\nBody with ![pic](pic.png)\n',
  '/data/articles/second.md': '---\ntitle: Second\n---\n\nSecond body.\n',
  '/data/articles/third.md': '---\ntitle: Third\n---\n\nThird body.\n',
  '/data/articles/secret.md': '---\ntitle: 神秘的文章\n---\n\nOnly by direct link.\n',
  '/data/pages/about.md': '---\ntitle: About\n---\n\nAbout body.\n',
}

export function stubFetch(): void {
  vi.stubGlobal('fetch', async (input: string | URL) => {
    const body = files[new URL(String(input), origin).pathname]

    return body === undefined ? new Response('not found', { status: 404 }) : new Response(body, { status: 200 })
  })
}

// Navigation is fire-and-forget and awaits a fetch, so draining microtasks is not enough.
async function flush(): Promise<void> {
  for (let i = 0; i < 6; i += 1) {
    await new Promise(resolve => {
      setTimeout(resolve, 0)
    })
  }
}

function outlet(): HTMLElement {
  const element = document.querySelector('bbg-outlet')
  if (element === null) throw new Error('no outlet')

  return element as HTMLElement
}

function click(anchor: Element): void {
  anchor.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, cancelable: true }))
}

export function describeThemeContract(theme: ThemeModule): void {
  // One happy-dom document is shared here, so a stale click listener would preventDefault first.
  let teardown: (() => void) | undefined

  async function boot(hash = ''): Promise<void> {
    document.body.innerHTML = '<bbg-outlet></bbg-outlet>'
    location.hash = hash

    // the real loader imports an absolute http URL, which Node cannot do
    teardown = await start(async () => theme)
    await flush()
  }

  beforeEach(stubFetch)

  afterEach(() => {
    teardown?.()
    teardown = undefined
    vi.unstubAllGlobals()
    location.hash = ''
  })

  describe('shell', () => {
    it('renders the nav, the list and the footer', async () => {
      await boot()

      expect(outlet().querySelector('bbg-nav')?.textContent).toContain('我的博客')
      expect(outlet().querySelector('bbg-article-list')).not.toBeNull()
      // the runtime renders the footer markdown, the theme only inserts it
      expect(outlet().querySelector('bbg-footer')?.innerHTML).toContain('<strong>me</strong>')
    })

    it('paginates using postsPerPage and links every page', async () => {
      await boot()

      expect(outlet().querySelectorAll('.bbg-card')).toHaveLength(2)
      expect(outlet().querySelectorAll('.bbg-pagination a')).toHaveLength(2)
    })

    it('lists pages in the nav', async () => {
      await boot()

      const link = outlet().querySelector('.bbg-site-nav a')
      expect(link?.textContent).toBe('About')
      expect(link?.getAttribute('href')).toBe('#/page/about')
    })

    it('never shows a hidden article in the list', async () => {
      await boot()

      expect(outlet().textContent).not.toContain('神秘的文章')
    })
  })

  describe('navigation', () => {
    it('intercepts a click, pushes history and renders the article', async () => {
      await boot()

      click(outlet().querySelector('.bbg-card-title a') as Element)
      await flush()

      expect(location.hash).toBe('#/post/first')
      expect(outlet().querySelector('bbg-article-view')?.textContent).toContain('Heading')
      expect(document.title).toContain('第一篇文章')
    })

    it('re-renders on popstate rather than reloading', async () => {
      await boot()

      click(outlet().querySelector('.bbg-card-title a') as Element)
      await flush()
      expect(outlet().querySelector('bbg-article-view')).not.toBeNull()

      location.hash = '#/'
      dispatchEvent(new PopStateEvent('popstate', { state: { route: { type: 'home', page: 1 } } }))
      await flush()

      expect(outlet().querySelector('bbg-article-list')).not.toBeNull()
      expect(outlet().querySelector('bbg-article-view')).toBeNull()
    })

    it('resolves a hidden article by direct link and marks it unlisted', async () => {
      await boot('#/post/secret')

      const view = outlet().querySelector('bbg-article-view')
      expect(view?.textContent).toContain('神秘的文章')
      expect(view?.querySelector('.bbg-unlisted')).not.toBeNull()
    })

    it('renders a page', async () => {
      await boot('#/page/about')

      expect(outlet().querySelector('bbg-page-view')?.textContent).toContain('About body.')
    })

    it('shows not-found for an unknown slug', async () => {
      await boot('#/post/nope')

      expect(outlet().querySelector('.bbg-not-found')).not.toBeNull()
    })
  })

  describe('markdown', () => {
    it('resolves a relative image against the article directory', async () => {
      await boot('#/post/first')

      expect(outlet().querySelector('.bbg-content img')?.getAttribute('src')).toBe('data/articles/pic.png')
    })
  })
}

import type { Manifest, PluginIndexEntry, SiteSettings } from '@bbg-next/core'
import type { PluginModule } from '@bbg-next/plugin'
import type { ThemeModule } from '@bbg-next/view'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { start } from '../src/boot.ts'

// Every theme must pass this unchanged. Wiring only, and one theme per file: `customElements` is per document.

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
    plugins: [],
  },
  theme: { name: 'default-theme', version: '1.0.0' },
  plugins: [],
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
      comments: true,
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
      comments: true,
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
      comments: true,
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
      comments: true,
    },
  ],
  // comments off, unlike every article
  pages: [
    {
      slug: 'about',
      file: 'about.md',
      title: 'About',
      updated: 1,
      showInNav: true,
      navLabel: 'About',
      comments: false,
    },
  ],
}

// `## Locked` and a relative image, behind `hunter2`
const locked =
  'v1.600000.1627e12601128af4975cd39209bd914f.5762abe80772e8593cf299d7.46e357c11a4ed7f9b8d4e5272c3817ed62674b32bbc5a03f77e2aa927f798bfde20935531f733b624b5f786e38b4abb224c2'

const files: Readonly<Record<string, string>> = {
  '/data/articles/first.md': '---\ntitle: 第一篇文章\n---\n\n# Heading\n\nBody with ![pic](pic.png)\n',
  '/data/articles/second.md': '---\ntitle: Second\n---\n\nSecond body.\n',
  '/data/articles/third.md': '---\ntitle: Third\n---\n\nThird body.\n',
  '/data/articles/secret.md': '---\ntitle: 神秘的文章\n---\n\nOnly by direct link.\n',
  '/data/pages/about.md': `---\ntitle: About\n---\n\nAbout body.\n\n\`\`\`bbg-encrypted\n${locked}\n\`\`\`\n`,
}

/** Serves the fixture site, with `override` merged into its manifest. */
function stubFetch(override: Partial<Manifest> = {}): void {
  const served: Readonly<Record<string, string>> = {
    ...files,
    '/data/site.json': JSON.stringify({ ...manifest, ...override }),
  }

  vi.stubGlobal('fetch', async (input: string | URL) => {
    const body = served[new URL(String(input), origin).pathname]

    return body === undefined ? new Response('not found', { status: 404 }) : new Response(body, { status: 200 })
  })
}

const probePlugin: PluginIndexEntry = {
  name: 'probe',
  version: '1.0.0',
  extensions: [],
  dependencies: {},
  hasConfig: false,
}

/** The fixture site with one plugin enabled, for tests that need the runtime to load one. */
export function stubFetchWithProbe(site: Partial<SiteSettings> = {}): void {
  stubFetch({ plugins: [probePlugin], site: { ...manifest.site, ...site, plugins: [probePlugin.name] } })
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

const tagHref = `#/tag/${encodeURIComponent('随笔')}`

function click(anchor: Element): void {
  anchor.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, cancelable: true }))
}

/** Back or forward to `hash`, as the browser reports it. */
async function visit(hash: string): Promise<void> {
  location.hash = hash
  dispatchEvent(new PopStateEvent('popstate', { state: null }))
  await flush()
}

export function describeThemeContract(theme: ThemeModule): void {
  // One happy-dom document is shared here, so a stale click listener would preventDefault first.
  let teardown: (() => void) | undefined

  // the real loader imports an absolute http URL, which Node cannot do
  async function boot(hash = '', setup?: PluginModule['setup']): Promise<void> {
    document.body.innerHTML = '<bbg-outlet></bbg-outlet>'
    location.hash = hash

    if (setup !== undefined) stubFetchWithProbe()

    teardown = await start(async () => theme, setup === undefined ? undefined : async () => ({ setup }))
    await flush()
  }

  beforeEach(() => void stubFetch())

  afterEach(() => {
    teardown?.()
    teardown = undefined
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
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

  describe('archive', () => {
    it('lists every listed article, and never a hidden one', async () => {
      await boot('#/archive')

      const archive = outlet().querySelector('bbg-archive-view')
      for (const title of ['第一篇文章', 'Second', 'Third']) expect(archive?.textContent).toContain(title)
      expect(archive?.textContent).not.toContain('神秘的文章')
    })

    it('links a card’s tags to their page, which lists only the articles carrying one', async () => {
      await boot()

      click(outlet().querySelector(`a[href="${tagHref}"]`) as Element)
      await flush()

      const archive = outlet().querySelector('bbg-archive-view')
      expect(archive?.textContent).toContain('第一篇文章')
      expect(archive?.textContent).not.toContain('Second')
    })

    it('is linked from the nav, which marks it on a tag’s page too', async () => {
      await boot(tagHref)

      expect(outlet().querySelector('bbg-nav a[href="#/archive"]')?.getAttribute('aria-current')).toBe('page')
    })

    it('shows not-found for a tag no listed article carries', async () => {
      await boot('#/tag/nope')

      expect(outlet().querySelector('.bbg-not-found')).not.toBeNull()
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

    // The shell is sent again as the marks move; a theme that only rendered it once would keep marking the first.
    it('marks the nav link to what is on screen, and moves the mark along', async () => {
      const marked = (): string | undefined =>
        outlet().querySelector('.bbg-site-nav [aria-current="page"]')?.textContent ?? undefined

      await boot()
      expect(marked()).toBeUndefined()

      click(outlet().querySelector('.bbg-site-nav a') as Element)
      await flush()
      expect(marked()).toBe('About')

      location.hash = '#/'
      dispatchEvent(new PopStateEvent('popstate', { state: { route: { type: 'home', page: 1 } } }))
      await flush()
      expect(marked()).toBeUndefined()
    })

    it('keeps the shell on screen as the reader moves, rather than drawing it again', async () => {
      await boot()
      const link = outlet().querySelector('.bbg-site-nav a')
      const footer = outlet().querySelector('bbg-footer strong')

      click(link as Element)
      await flush()

      expect(outlet().querySelector('.bbg-site-nav a')).toBe(link)
      expect(outlet().querySelector('bbg-footer strong')).toBe(footer)
    })

    it('shows not-found for an unknown slug', async () => {
      await boot('#/post/nope')

      expect(outlet().querySelector('.bbg-not-found')).not.toBeNull()
    })

    it('scrolls to the heading the URL names once the article is in', async () => {
      const scrolled = vi.spyOn(Element.prototype, 'scrollIntoView')
      await boot('#/post/first#Heading')

      expect(scrolled.mock.contexts).toEqual([outlet().querySelector('.bbg-content h1')])
    })

    it('moves within an article without rendering it again', async () => {
      await boot('#/post/first')
      const article = outlet().querySelector('bbg-article-view')
      const scrolled = vi.spyOn(Element.prototype, 'scrollIntoView')

      click(outlet().querySelector('.bbg-anchor') as Element)
      await flush()

      expect(location.hash).toBe('#/post/first#Heading')
      expect(outlet().querySelector('bbg-article-view')).toBe(article)
      expect(scrolled.mock.contexts).toEqual([outlet().querySelector('.bbg-content h1')])
    })

    // The browser would restore a position before the view is back, so the runtime does it once the view has rendered.
    it('takes the reader back to where they left the list', async () => {
      await boot()
      const list: unknown = history.state
      scrollTo({ top: 80, behavior: 'instant' })

      click(outlet().querySelector('.bbg-card-title a') as Element)
      await flush()
      expect(scrollY).toBe(0)

      location.hash = '#/'
      dispatchEvent(new PopStateEvent('popstate', { state: list }))
      await flush()

      expect(outlet().querySelector('bbg-article-list')).not.toBeNull()
      expect(scrollY).toBe(80)
    })

    it('takes the reader back within an article without rendering it again', async () => {
      await boot('#/post/first')
      const top: unknown = history.state
      const article = outlet().querySelector('bbg-article-view')
      scrollTo({ top: 30, behavior: 'instant' })

      click(outlet().querySelector('.bbg-anchor') as Element)
      await flush()
      scrollTo({ top: 400, behavior: 'instant' })

      location.hash = '#/post/first'
      dispatchEvent(new PopStateEvent('popstate', { state: top }))
      await flush()

      expect(scrollY).toBe(30)
      expect(outlet().querySelector('bbg-article-view')).toBe(article)
    })

    it('follows an address-bar edit to where it points', async () => {
      await boot('#/post/first')
      const article = outlet().querySelector('bbg-article-view')
      const scrolled = vi.spyOn(Element.prototype, 'scrollIntoView')

      location.hash = '#/post/first#Heading'
      dispatchEvent(new PopStateEvent('popstate', { state: null }))
      await flush()

      expect(scrolled.mock.contexts).toEqual([outlet().querySelector('.bbg-content h1')])
      expect(outlet().querySelector('bbg-article-view')).toBe(article)
    })
  })

  describe('markdown', () => {
    it('resolves a relative image against the article directory', async () => {
      await boot('#/post/first')

      expect(outlet().querySelector('.bbg-content img')?.getAttribute('src')).toBe('data/articles/pic.png')
    })

    it('opens an encrypted block into markdown rendered as the page around it is', async () => {
      await boot('#/page/about')

      const block = outlet().querySelector('bbg-encrypted')
      const input = block?.querySelector('input')
      if (!block || !input) throw new Error('no encrypted block drawn')

      input.value = 'hunter2'
      block.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }))

      await vi.waitFor(() => expect(block.querySelector('img')?.getAttribute('src')).toBe('data/pages/pic.png'))
      expect(block.querySelector('h2 > a.bbg-anchor')?.getAttribute('href')).toBe('#/page/about#Locked')
    })

    it('keeps the permalink a heading opens with', async () => {
      await boot('#/post/first')

      const heading = outlet().querySelector('.bbg-content h1')
      expect(heading?.id).toBe('Heading')
      expect(heading?.firstElementChild?.matches('a.bbg-anchor[href="#/post/first#Heading"]')).toBe(true)
    })
  })

  describe('plugins', () => {
    // The hook fires straight after replaceChildren; a theme rendering later would hand plugins an empty element.
    it('has the theme’s output in place by the time a rendered hook runs', async () => {
      const seen: (string | undefined)[] = []

      await boot(
        '#/post/first',
        context =>
          void context.onRendered(({ element }) => {
            seen.push(element.querySelector('.bbg-content h1')?.textContent ?? undefined)
          }),
      )

      expect(seen).toEqual(['Heading'])
    })

    it('hands a hook the view on screen after every navigation, the same element while the kind stays', async () => {
      const seen: [string, Element][] = []

      await boot(
        '#/post/first',
        context => void context.onRendered(({ element, route }) => void seen.push([route.type, element])),
      )
      await visit('#/post/second')
      await visit('#/page/about')

      expect(seen.map(([type]) => type)).toEqual(['article', 'article', 'page'])
      expect(seen[1]?.[1]).toBe(seen[0]?.[1])
      expect(seen[2]?.[1]).not.toBe(seen[1]?.[1])
    })

    it('leaves what a plugin put into the view where it is while the view stays', async () => {
      const mark = document.createElement('aside')
      let placed = false

      // Placed once only, so a theme that redraws the whole view is caught taking it out.
      await boot(
        '#/post/first',
        context =>
          void context.onRendered(({ element }) => {
            if (!placed) element.prepend(mark)
            placed = true
          }),
      )
      await visit('#/post/second')

      expect(mark.isConnected).toBe(true)
      expect(outlet().querySelector('bbg-article-view .bbg-content')?.textContent).toContain('Second body.')
    })
  })

  describe('light DOM', () => {
    // Plugins walk the rendered DOM; a shadow root would silently hide it from all of them.
    it('leaves rendered content reachable from the document', async () => {
      await boot('#/post/first')

      const article = document.querySelector('bbg-article-view')
      expect(article?.shadowRoot ?? null).toBeNull()
      expect(document.querySelector('.bbg-content h1')).not.toBeNull()
    })
  })
}

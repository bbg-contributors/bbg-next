// @vitest-environment happy-dom
import type { PluginSetup, Route } from '@bbg-next/plugin'
import type { ThemeContext } from '@bbg-next/view'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { start } from '../src/boot.ts'
import { stubFetchWithProbe } from '../testing/index.ts'
import * as stubTheme from './stubTheme.ts'

let teardown: (() => void) | undefined

beforeEach(() => {
  stubFetchWithProbe()
  document.body.innerHTML = '<bbg-outlet></bbg-outlet>'
})

afterEach(() => {
  teardown?.()
  teardown = undefined
  vi.unstubAllGlobals()
  location.hash = ''
})

/** The fixture site with the stub theme, its one plugin set up by `setup`. */
async function boot(setup: PluginSetup = () => {}): Promise<void> {
  teardown = await start(
    async () => stubTheme,
    async () => ({ setup }),
  )
}

describe('startup in parallel', () => {
  it('has the theme downloading by the time a plugin sets up', async () => {
    const seen: boolean[] = []
    let asked = false

    teardown = await start(
      async () => {
        asked = true

        return stubTheme
      },
      async () => ({ setup: () => void seen.push(asked) }),
    )

    expect(seen).toEqual([true])
  })
})

describe('what the theme is told', () => {
  async function registered(): Promise<ThemeContext | undefined> {
    let received: ThemeContext | undefined

    teardown = await start(
      async () => ({
        register: context => {
          received = context
          stubTheme.register()
        },
      }),
      async () => ({ setup: () => {} }),
    )

    return received
  }

  it('hands over the seed, the theme’s own config and the plugins that started', async () => {
    stubFetchWithProbe({ seed: '#e8590c' }, { wallpaper: 'background.webp' })

    const context = await registered()
    expect(context?.seed).toBe('#e8590c')
    expect(context?.options).toEqual({ wallpaper: 'background.webp' })
    expect(context?.plugins).toEqual([{ name: 'probe', version: '1.0.0' }])
  })
})

describe('what plugins are told', () => {
  it.each([
    ['#/', false],
    ['#/article/first', true],
    // its front matter turns them off
    ['#/page/about', false],
  ])('whether comments belong on %s', async (hash, expected) => {
    const seen: boolean[] = []
    location.hash = hash

    await boot(context => void context.onRendered(view => void seen.push(view.comments)))

    expect(seen).toEqual([expected])
  })

  it('nothing of a view that is not found', async () => {
    const seen: string[] = []
    location.hash = '#/article/nope'

    await boot(context => void context.onRendered(view => void seen.push(view.route.type)))

    expect(document.querySelector('.bbg-not-found')).not.toBeNull()
    expect(seen).toEqual([])
  })
})

describe('an address a plugin moves as it sets up', () => {
  it('is where the runtime lands', async () => {
    const seen: Route[] = []

    await boot(context => {
      history.replaceState(null, '', '#/article/second')
      context.onRendered(view => void seen.push(view.route))
    })

    expect(seen).toEqual([{ type: 'article', slug: 'second' }])
  })
})

/** Clicks a link to `href` and reports whether the runtime took the click, keeping the browser where it is either way. */
function follow(href: string): boolean {
  const link = Object.assign(document.createElement('a'), { href })
  document.body.append(link)

  let taken = false
  addEventListener(
    'click',
    event => {
      taken = event.defaultPrevented
      event.preventDefault()
    },
    { once: true },
  )
  link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

  return taken
}

describe('an address a plugin knows', () => {
  // As legacy-routes knows the old editor's: `?old=<slug>` is that article.
  const knowsOld: PluginSetup = context => {
    context.registerRedirect(url => {
      const slug = url.searchParams.get('old')

      return slug === null ? null : { type: 'article', slug }
    })
  }

  afterEach(() => void history.replaceState(null, '', '/'))

  it('gives way to the route’s own on landing, query and all', async () => {
    const seen: Route[] = []
    history.replaceState(null, '', '/index.html?old=second')

    await boot(context => {
      knowsOld(context)
      context.onRendered(view => void seen.push(view.route))
    })

    expect(location.pathname + location.search + location.hash).toBe('/index.html#/article/second')
    expect(seen).toEqual([{ type: 'article', slug: 'second' }])
  })

  it('is shown in place when a link to it is followed', async () => {
    await boot(knowsOld)

    expect(follow('data/articles/index.html?old=second')).toBe(true)
    await vi.waitFor(() => expect(document.title).toBe('Second — 我的博客'))
    expect(location.hash).toBe('#/article/second')
  })
})

describe('a link to what is not a view', () => {
  it.each(['data/articles/report.pdf', '?page=2'])('%s is left to the browser', async href => {
    await boot()

    expect(follow(href)).toBe(false)
  })
})

describe('a deep link in hash mode', () => {
  // As 404.html carries it, to find the site from any depth.
  beforeEach(() => void document.head.append(Object.assign(document.createElement('base'), { href: '/' })))

  afterEach(() => {
    document.querySelector('base')?.remove()
    history.replaceState(null, '', '/')
  })

  it('shows its view, with the route moved where hash mode keeps it and the fragment kept', async () => {
    const seen: string[] = []
    history.replaceState(null, '', '/article/first/#c1')

    await boot(context => void context.onRendered(view => void seen.push(view.route.type)))

    expect(seen).toEqual(['article'])
    expect(location.pathname).toBe('/')
    expect(location.hash).toBe('#/article/first#c1')
  })
})

describe('the shell', () => {
  // Sent from within the popstate handler, ahead of the fetch.
  function go(hash: string): void {
    location.hash = hash
    dispatchEvent(new PopStateEvent('popstate', { state: null }))
  }

  it('is sent again only when a mark moves', async () => {
    location.hash = '#/article/first'
    await boot()
    const sent = vi.spyOn(document.querySelector('bbg-nav') as HTMLElement & { model: unknown }, 'model', 'set')

    go('#/article/second')
    expect(sent).not.toHaveBeenCalled()

    go('#/archive')
    expect(sent).toHaveBeenCalledOnce()
  })
})

describe('a navigation overtaken by another', () => {
  it('gives way to the view asked for last, whichever arrives first', async () => {
    await boot()
    const served = fetch
    let release = (): void => {}
    vi.stubGlobal('fetch', async (input: string | URL) => {
      if (String(input).endsWith('/first.md')) await new Promise<void>(resolve => void (release = resolve))

      return served(input)
    })

    for (const hash of ['#/article/first', '#/article/second']) {
      location.hash = hash
      dispatchEvent(new PopStateEvent('popstate', { state: null }))
    }
    await vi.waitFor(() => expect(document.title).toBe('Second — 我的博客'))
    release()
    await new Promise(resolve => void setTimeout(resolve, 10))

    expect(document.title).toBe('Second — 我的博客')
    expect(document.querySelector('bbg-article-view')?.textContent).toContain('Second body.')
  })
})

// @vitest-environment happy-dom
import type { ColorScheme, PluginContext, RenderedHandler, Route } from '@bbg-next/plugin'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { setup } from '../src/index.ts'

const init = vi.hoisted(() => vi.fn<(options: Readonly<Record<string, unknown>>) => Promise<void>>(async () => {}))
vi.mock('twikoo', () => ({ version: '2.0.9', init }))

let rendered: RenderedHandler = () => {}
let schemeChanged: (scheme: ColorScheme) => void = () => {}

function article(slug: string): Route {
  return { type: 'article', slug }
}

function view(route: Route, comments: boolean, element: HTMLElement = document.createElement('div')): HTMLElement {
  if (!element.isConnected) document.body.replaceChildren(element)
  rendered({ element, route, comments })

  return element
}

function host(): HTMLElement | null {
  return document.querySelector('.bbg-twikoo')
}

function threads(): unknown[] {
  return init.mock.calls.map(([{ path }]) => path)
}

describe('twikoo', () => {
  beforeAll(() => {
    // Only what it reads.
    const context = {
      options: { envId: 'https://twikoo.test', path: '/elsewhere' },
      site: { lang: 'ja' },
      onRendered: (handler: RenderedHandler) => {
        rendered = handler
      },
      onColorScheme: (handler: (scheme: ColorScheme) => void) => {
        schemeChanged = handler
        handler('light')
      },
    }
    setup(context as unknown as PluginContext)
  })

  // A view without comments lets go of any thread.
  beforeEach(() => {
    view({ type: 'home', page: 1 }, false)
    init.mockClear()
  })

  it('loads the thread of the article on screen, in the site’s language, with a link its notifications can use', () => {
    const element = view(article('a'), true)

    expect(host()?.parentElement).toBe(element)
    expect(init).toHaveBeenCalledExactlyOnceWith({
      envId: 'https://twikoo.test',
      lang: 'ja',
      localeBaseUrl: 'https://cdn.jsdelivr.net/npm/twikoo@2.0.9/dist',
      el: host(),
      path: '/post/a/',
      href: `${location.origin}/post/a/`,
    })
  })

  it('keeps the thread while it stays on screen, and moves on to the next article’s', () => {
    const element = view(article('a'), true)
    const first = host()
    view(article('a'), true, element)
    view(article('b'), true, element)

    expect(host()).toBe(first)
    expect(threads()).toEqual(['/post/a/', '/post/b/'])
  })

  it('leaves a view without comments, and loads the thread afresh on the way back', () => {
    view(article('a'), true)
    view(article('b'), false)
    expect(host()).toBeNull()

    view(article('a'), true)
    expect(threads()).toEqual(['/post/a/', '/post/a/'])
  })

  it('follows the colour scheme', () => {
    view(article('a'), true)
    expect(host()?.getAttribute('data-user-color-scheme')).toBe('light')

    schemeChanged('dark')
    expect(host()?.getAttribute('data-user-color-scheme')).toBe('dark')
  })
})

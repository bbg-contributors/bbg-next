// @vitest-environment happy-dom
// @vitest-environment-options { "settings": { "handleDisabledFileLoadingAsSuccess": true } }
import type { ColorScheme, PluginContext, RenderedHandler, Route } from '@bbg-next/plugin'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { setup } from '../src/index.ts'

const started = vi.fn<(options: Readonly<Record<string, unknown>>) => void>()
const destroyed = vi.fn<(root: unknown) => void>()

// happy-dom runs no script and reports each as loaded, so this stands in for what the server's defines.
window.Rustaline = class {
  readonly #root: unknown

  constructor(options: Readonly<Record<string, unknown>>) {
    started(options)
    this.#root = options['el']
  }

  readonly destroy = (): void => void destroyed(this.#root)
}

let rendered: RenderedHandler = () => {}
let scheme: (scheme: ColorScheme) => void = () => {}

function article(slug: string): Route {
  return { type: 'article', slug }
}

async function view(
  route: Route,
  comments: boolean,
  element: HTMLElement = document.createElement('div'),
): Promise<HTMLElement> {
  if (!element.isConnected) document.body.replaceChildren(element)
  rendered({ element, route, comments })
  // The SDK arrives a few promises later.
  await new Promise(resolve => setTimeout(resolve))

  return element
}

function roots(): unknown[] {
  return started.mock.calls.map(([{ el }]) => el)
}

function threads(): unknown[] {
  return started.mock.calls.map(([{ url }]) => url)
}

describe('rustaline', () => {
  beforeAll(() => {
    // Only what it reads.
    const context = {
      options: { server: 'https://rustaline.test/', url: '/elsewhere', darkMode: 'auto', placeholder: 'Hi' },
      site: { lang: 'ja', seed: '#e8590c' },
      onRendered: (handler: RenderedHandler) => {
        rendered = handler
      },
      onColorScheme: (handler: (scheme: ColorScheme) => void) => {
        scheme = handler
        handler('light')
      },
    }
    setup(context as unknown as PluginContext)
  })

  // A view without comments lets go of any thread.
  beforeEach(async () => {
    await view({ type: 'home', page: 1 }, false)
    scheme('light')
    started.mockClear()
    destroyed.mockClear()
  })

  it('loads the SDK from the server, and the article’s thread in the site’s colour and a language rustaline has', async () => {
    await view(article('a'), true)

    expect([...document.querySelectorAll('script')].map(script => script.src)).toEqual([
      'https://rustaline.test/sdk/rustaline.js',
    ])
    expect(started).toHaveBeenCalledExactlyOnceWith({
      server: 'https://rustaline.test',
      lang: 'auto',
      colorPattern: '#e8590c',
      placeholder: 'Hi',
      el: document.querySelector('[data-bbg-plugin="rustaline"] > div'),
      url: '/article/a/',
      darkMode: 'light',
    })
  })

  it('starts each thread in an element of its own, since a destroyed one still draws into its own', async () => {
    const element = await view(article('a'), true)
    await view(article('a'), true, element)
    await view(article('b'), true, element)

    const [first, second] = roots()
    expect(threads()).toEqual(['/article/a/', '/article/b/'])
    expect(destroyed).toHaveBeenCalledExactlyOnceWith(first)
    expect([...element.querySelectorAll('[data-bbg-plugin="rustaline"] > div')]).toEqual([second])
  })

  it('leaves a view without comments, and starts the thread afresh on the way back', async () => {
    await view(article('a'), true)
    await view(article('b'), false)
    expect(document.querySelector('[data-bbg-plugin="rustaline"]')).toBeNull()

    await view(article('a'), true)
    expect(threads()).toEqual(['/article/a/', '/article/a/'])
  })

  it('follows the page’s scheme, which need not be the system’s', async () => {
    const element = await view(article('a'), true)
    scheme('dark')
    expect((roots()[0] as HTMLElement).classList.contains('rs-dark')).toBe(true)

    await view(article('b'), true, element)
    expect(started.mock.calls[1]?.[0]).toMatchObject({ darkMode: 'dark' })
  })
})

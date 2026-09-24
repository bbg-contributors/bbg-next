// @vitest-environment happy-dom
import type { ThemeContext } from '@bbg-next/view'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { start } from '../src/boot.ts'
import { stubFetchWithProbe } from '../testing/index.ts'
import * as stubTheme from './stubTheme.ts'

describe('startup failure', () => {
  afterEach(() => void vi.unstubAllGlobals())

  it('reports it instead of leaving a blank page', async () => {
    vi.stubGlobal('fetch', async () => new Response('nope', { status: 500 }))
    document.body.innerHTML = '<bbg-outlet></bbg-outlet>'

    await expect(start(async () => stubTheme)).rejects.toThrow(/500/)
  })

  it('reports a missing outlet', async () => {
    document.body.innerHTML = ''

    await expect(start(async () => stubTheme)).rejects.toThrow(/bbg-outlet/)
  })
})

describe('startup in parallel', () => {
  let teardown: (() => void) | undefined

  beforeEach(() => {
    stubFetchWithProbe()
    document.body.innerHTML = '<bbg-outlet></bbg-outlet>'
  })

  afterEach(() => {
    teardown?.()
    teardown = undefined
    vi.unstubAllGlobals()
  })

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
  let teardown: (() => void) | undefined

  beforeEach(() => void (document.body.innerHTML = '<bbg-outlet></bbg-outlet>'))

  afterEach(() => {
    teardown?.()
    teardown = undefined
    vi.unstubAllGlobals()
  })

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

  it('hands over the seed and the plugins that started', async () => {
    stubFetchWithProbe({ seed: '#e8590c' })

    const context = await registered()
    expect(context?.seed).toBe('#e8590c')
    expect(context?.plugins).toEqual([{ name: 'probe', version: '1.0.0' }])
  })

  it('leaves the seed out when the site set none, so the theme falls back to its own', async () => {
    stubFetchWithProbe()

    expect((await registered())?.seed).toBeUndefined()
  })
})

describe('what plugins are told', () => {
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

  it.each([
    ['#/', false],
    ['#/archive', false],
    ['#/post/first', true],
    // its front matter turns them off
    ['#/page/about', false],
  ])('whether comments belong on %s', async (hash, expected) => {
    const seen: boolean[] = []
    location.hash = hash

    teardown = await start(
      async () => stubTheme,
      async () => ({ setup: context => void context.onRendered(view => void seen.push(view.comments)) }),
    )

    expect(seen).toEqual([expected])
  })

  it.each(['#/post/nope', '#/list/9', '#/tag/nope', '#/nowhere'])('nothing of %s, which is not found', async hash => {
    const seen: string[] = []
    location.hash = hash

    teardown = await start(
      async () => stubTheme,
      async () => ({ setup: context => void context.onRendered(view => void seen.push(view.route.type)) }),
    )

    expect(document.querySelector('.bbg-not-found')).not.toBeNull()
    expect(seen).toEqual([])
  })
})

describe('the runtime’s own words', () => {
  let teardown: (() => void) | undefined

  beforeEach(() => void (document.body.innerHTML = '<bbg-outlet></bbg-outlet>'))

  afterEach(() => {
    teardown?.()
    teardown = undefined
    vi.unstubAllGlobals()
    location.hash = ''
  })

  it.each([
    ['zh-CN', '#/archive', '归档和标签 — 我的博客', null],
    ['zh-CN', `#/tag/${encodeURIComponent('随笔')}`, '标签为 #随笔 下的文章 — 我的博客', null],
    ['ja', '#/post/nope', '見つかりません — 我的博客', 'この記事は存在しないか、削除されました。'],
    ['en', '#/list/9', 'Not found — 我的博客', 'This page of the article list does not exist.'],
  ])('come in %s: %s is titled %s', async (lang, hash, title, message) => {
    stubFetchWithProbe({ lang })
    location.hash = hash

    teardown = await start(
      async () => stubTheme,
      async () => ({ setup: () => {} }),
    )

    expect(document.title).toBe(title)
    if (message !== null) expect(document.querySelector('.bbg-not-found')?.textContent).toBe(message)
  })
})

describe('the shell', () => {
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

  // Sent from within the popstate handler, ahead of the fetch.
  function go(hash: string): void {
    location.hash = hash
    dispatchEvent(new PopStateEvent('popstate', { state: null }))
  }

  it('is sent again only when a mark moves', async () => {
    location.hash = '#/post/first'
    teardown = await start(
      async () => stubTheme,
      async () => ({ setup: () => {} }),
    )
    const sent = vi.spyOn(document.querySelector('bbg-nav') as HTMLElement & { model: unknown }, 'model', 'set')

    go('#/post/second')
    expect(sent).not.toHaveBeenCalled()

    go('#/archive')
    expect(sent).toHaveBeenCalledOnce()
  })
})

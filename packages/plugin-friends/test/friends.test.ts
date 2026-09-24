// @vitest-environment happy-dom
import type { PluginContext } from '@bbg-next/plugin'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { setup } from '../src/index.ts'

function place(source: string, base?: string): HTMLElement {
  const list = document.createElement('bbg-friends')
  list.setAttribute('data-source', source)
  if (base !== undefined) list.setAttribute('data-base', base)
  document.body.replaceChildren(list)

  return list
}

function names(list: HTMLElement): string[] {
  return [...list.querySelectorAll('.bbg-friend-name')].map(name => name.textContent ?? '')
}

function shuffle(list: HTMLElement): HTMLButtonElement {
  const button = list.querySelector<HTMLButtonElement>('.bbg-friends-shuffle')
  if (button === null) throw new Error('no shuffle switch')

  return button
}

// It reads nothing from its context.
beforeAll(() => void setup({} as PluginContext))

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('a friends block', () => {
  // In the order written, unless shuffling is what a test is about.
  beforeEach(() => void localStorage.setItem('bbg-friends-shuffle', 'off'))

  it('draws a card for each friend, in the order written', () => {
    const list = place(
      'name: 小明的博客\nurl: https://xiaoming.example\navatar: https://xiaoming.example/a.png\ndescription: 写代码也写诗\n\nname: Alice\nurl: https://alice.example\n',
    )

    const [first, second] = list.querySelectorAll<HTMLAnchorElement>('a.bbg-friend')
    expect(names(list)).toEqual(['小明的博客', 'Alice'])
    expect(first?.href).toBe('https://xiaoming.example/')
    expect(first?.title).toBe('写代码也写诗')
    expect(first?.querySelector('img')?.src).toBe('https://xiaoming.example/a.png')
    expect(second?.querySelector('.bbg-friend-avatar')?.textContent).toBe('A')
  })

  it('drops a friend with no name, or with a link that is no web address', () => {
    const list = place(
      'url: https://nameless.example\n\nname: Evil\nurl: javascript:alert(1)\n\nname: Local\nurl: /friends/local\n',
    )

    expect(names(list)).toEqual(['Local'])
    expect(list.querySelector('a')?.href).toBe(new URL('/friends/local', document.baseURI).href)
  })

  it('resolves a relative address as the page does its pictures, and one from a source against its file', async () => {
    const fetched: string[] = []
    vi.stubGlobal('fetch', async (input: string | URL) => {
      fetched.push(String(input))

      return new Response(JSON.stringify([{ name: 'Far', url: 'https://far.example', avatar: 'far.svg' }]))
    })
    const list = place(
      'name: Near\nurl: https://near.example\navatar: friends/near.svg\n\nsource: lists/friends.json\n',
      'data/pages/',
    )

    await vi.waitFor(() => expect(names(list)).toEqual(['Near', 'Far']))
    const [near, far] = list.querySelectorAll('img')
    expect(near?.src).toBe(new URL('data/pages/friends/near.svg', document.baseURI).href)
    expect(fetched).toEqual([new URL('data/pages/lists/friends.json', document.baseURI).href])
    expect(far?.src).toBe(new URL('data/pages/lists/far.svg', document.baseURI).href)
  })

  it('puts the initial in place of an avatar that will not load', () => {
    const list = place('name: 夜航船\nurl: https://night.example\navatar: https://night.example/gone.png\n')

    list.querySelector('img')?.dispatchEvent(new Event('error'))

    expect(list.querySelector('img')).toBeNull()
    expect(list.querySelector('.bbg-friend-avatar')?.textContent).toBe('夜')
  })

  it('loads friends from a source, landing them where its block stood', async () => {
    vi.stubGlobal(
      'fetch',
      async () =>
        new Response(JSON.stringify([{ name: 'Middle', url: 'https://middle.example' }, { name: 'No link' }])),
    )
    const list = place(
      'name: First\nurl: https://first.example\n\nsource: https://example.com/friends.json\n\nname: Last\nurl: https://last.example\n',
    )

    await vi.waitFor(() => expect(names(list)).toEqual(['First', 'Middle', 'Last']))
  })

  it('carries on without a source that fails', async () => {
    vi.stubGlobal('fetch', async () => new Response('gone', { status: 404 }))
    const reported = vi.spyOn(console, 'error').mockImplementation(() => {})
    const list = place('source: https://example.com/friends.json\n\nname: Kept\nurl: https://kept.example\n')

    await vi.waitFor(() => expect(reported).toHaveBeenCalled())
    expect(names(list)).toEqual(['Kept'])
  })
})

describe('shuffling', () => {
  const five = ['A', 'B', 'C', 'D', 'E'].map(name => `name: ${name}\nurl: https://${name}.example\n`).join('\n')

  function lots(...values: number[]): void {
    vi.spyOn(Math, 'random').mockImplementation(() => values.shift() ?? 0)
  }

  it('is on to begin with, and draws the friends in a fresh order', () => {
    lots(0.9, 0.1, 0.5, 0.3, 0.7)
    const list = place(five)

    expect(shuffle(list).getAttribute('aria-checked')).toBe('true')
    expect(names(list)).toEqual(['B', 'D', 'C', 'E', 'A'])
  })

  it('goes back to the order written when turned off, and remembers that', () => {
    lots(0.9, 0.1, 0.5, 0.3, 0.7)
    const list = place(five)
    shuffle(list).click()

    expect(names(list)).toEqual(['A', 'B', 'C', 'D', 'E'])
    expect(shuffle(place(five)).getAttribute('aria-checked')).toBe('false')
  })

  it('slots friends from a source into the shuffle without moving the rest', async () => {
    lots(0.2, 0.8, 0.5)
    vi.stubGlobal(
      'fetch',
      async () => new Response(JSON.stringify([{ name: 'Middle', url: 'https://middle.example' }])),
    )
    const list = place(
      'name: First\nurl: https://first.example\n\nsource: https://example.com/friends.json\n\nname: Last\nurl: https://last.example\n',
    )

    expect(names(list)).toEqual(['First', 'Last'])
    await vi.waitFor(() => expect(names(list)).toEqual(['First', 'Middle', 'Last']))
  })

  it('stays out of the way for a single friend', () => {
    expect(shuffle(place('name: Only\nurl: https://only.example\n')).hidden).toBe(true)
  })
})

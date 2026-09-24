// @vitest-environment happy-dom
import type { PluginContext, RenderedHandler, Route } from '@bbg-next/plugin'
import { beforeAll, describe, expect, it } from 'vitest'
import { setup } from '../src/index.ts'

let rendered: RenderedHandler = () => {}

const home: Route = { type: 'home', page: 1 }

function view(route: Route, element: HTMLElement = document.createElement('div')): HTMLElement {
  if (!element.isConnected) document.body.replaceChildren(element)
  rendered({ element, route, comments: false })

  return element
}

function boxes(): number {
  return document.querySelectorAll('.bbg-announcement').length
}

describe('the announcement', () => {
  beforeAll(() => {
    // Only what it reads.
    const context = {
      options: { text: '**Hello**' },
      site: { lang: 'en' },
      require: () => ({ instance: { render: (source: string) => `<p>${source}</p>` } }),
      onRendered: (handler: RenderedHandler) => {
        rendered = handler
      },
    }
    setup(context as unknown as PluginContext)
  })

  it('stays put from one page of the list to the next', () => {
    const list = view(home)
    const box = list.querySelector('.bbg-announcement')

    view({ type: 'home', page: 2 }, list)

    expect(list.querySelector('.bbg-announcement')).toBe(box)
    expect(boxes()).toBe(1)
  })

  it('follows the list into a new view, and leaves the routes it was not asked onto', () => {
    const list = view(home)
    expect(list.firstElementChild?.matches('.bbg-announcement')).toBe(true)

    view({ type: 'article', slug: 'a' })
    expect(boxes()).toBe(0)
  })
})

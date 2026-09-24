// @vitest-environment happy-dom
import type { PluginContext, RenderedHandler, Route } from '@bbg-next/plugin'
import { beforeAll, describe, expect, it } from 'vitest'
import { setup } from '../src/index.ts'

let rendered: RenderedHandler = () => {}

function view(html: string, route: Route = { type: 'article', slug: 'a' }): HTMLElement {
  const element = document.createElement('div')
  element.innerHTML = html
  document.body.replaceChildren(element)
  rendered({ element, route, comments: false })

  return element
}

function click(target: Element | null): void {
  target?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

function viewer(): HTMLDialogElement | null {
  return document.querySelector('dialog.bbg-image-viewer')
}

describe('the image viewer', () => {
  beforeAll(() => {
    // Only what it reads.
    const context = {
      site: { lang: 'zh-CN' },
      onRendered: (handler: RenderedHandler) => {
        rendered = handler
      },
    }
    setup(context as unknown as PluginContext)
  })

  it('opens a picture clicked in an article, with its alt text and a way out to the file', () => {
    click(view('<p><img src="cat.png" alt="A cat"></p>').querySelector('img'))

    expect(viewer()?.open).toBe(true)
    expect(viewer()?.querySelector('img')?.getAttribute('src')).toBe(new URL('cat.png', document.baseURI).href)
    expect(viewer()?.querySelector('figcaption')?.textContent).toBe('A cat')
    expect(viewer()?.querySelector('a')?.textContent).toBe('在新标签页打开')

    click(viewer())
    expect(viewer()?.open).toBe(false)
  })

  it('opens one that turns up after the render, as a decrypted block’s would', () => {
    const element = view('<p>Nothing yet.</p>')
    element.insertAdjacentHTML('beforeend', '<p><img src="late.png" alt=""></p>')
    click(element.querySelector('img'))

    expect(viewer()?.open).toBe(true)
    click(viewer())
  })

  it('leaves a picture inside a link to the link', () => {
    click(view('<a href="elsewhere"><img src="dog.png" alt=""></a>').querySelector('img'))

    expect(viewer()?.open ?? false).toBe(false)
  })

  it('stays out of the lists', () => {
    click(view('<img src="cover.png" alt="">', { type: 'home', page: 1 }).querySelector('img'))

    expect(viewer()?.open ?? false).toBe(false)
  })

  it('lets go of a view the reader has moved on from, even one that stays on screen', () => {
    const element = view('<img src="cover.png" alt="">')
    rendered({ element, route: { type: 'home', page: 1 }, comments: false })
    click(element.querySelector('img'))

    expect(viewer()?.open ?? false).toBe(false)
  })
})

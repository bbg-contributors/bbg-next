// @vitest-environment happy-dom
import type { ColorSchemeControl } from '@bbg-next/view'
import { beforeEach, describe, expect, it } from 'vitest'
import { register } from '../src/index.ts'

const colorScheme: ColorSchemeControl = {
  current: () => 'light',
  preference: () => 'auto',
  set: () => {},
  subscribe: handler => {
    handler('light')

    return () => {}
  },
}

/** What lies first in the body once the theme starts with this config. */
function start(options: Readonly<Record<string, unknown>>): Element | null {
  register({ colorScheme, seed: undefined, options, plugins: [] })

  return document.body.firstElementChild
}

function laid(wallpaper = 'https://example.com/random'): HTMLImageElement {
  const image = start({ wallpaper })
  if (!(image instanceof HTMLImageElement)) throw new Error('no wallpaper laid')

  return image
}

describe('the wallpaper', () => {
  beforeEach(() => void document.body.replaceChildren(document.createElement('bbg-outlet')))

  it('goes under the page, fetched from where the config says with no referrer', () => {
    const image = laid()

    expect(image.src).toBe('https://example.com/random')
    expect(image.referrerPolicy).toBe('no-referrer')
    expect(image.nextElementSibling?.localName).toBe('bbg-outlet')
  })

  it('fades in once loaded, and leaves no trace when it fails', () => {
    const shown = laid()
    shown.dispatchEvent(new Event('load'))
    expect(shown.hasAttribute('data-loaded')).toBe(true)

    const failed = laid()
    failed.dispatchEvent(new Event('error'))
    expect(failed.isConnected).toBe(false)
  })

  it('is laid only when the config names one', () => {
    expect(start({})?.localName).toBe('bbg-outlet')
    expect(start({ wallpaper: true })?.localName).toBe('bbg-outlet')
  })
})

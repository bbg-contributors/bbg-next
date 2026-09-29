// @vitest-environment happy-dom
import type { ColorSchemeControl } from '@bbg-next/view'
import { beforeEach, describe, expect, it } from 'vitest'
import { decorate } from '../src/decorate.ts'

const colorScheme: ColorSchemeControl = {
  current: () => 'light',
  preference: () => 'auto',
  set: () => {},
  subscribe: handler => {
    handler('light')

    return () => {}
  },
}

/** Starts the theme with a wallpaper configured, and gives back what lies first in the body. */
function laid(wallpaper = 'https://example.com/random'): HTMLImageElement {
  decorate({ colorScheme, seed: undefined, options: { wallpaper }, plugins: [] })
  const image = document.body.firstElementChild
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
})

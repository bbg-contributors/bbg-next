// @vitest-environment happy-dom
import type { ColorScheme, PluginContext } from '@bbg-next/plugin'
import { beforeEach, describe, expect, it } from 'vitest'
import { setup } from '../src/index.ts'

let setScheme: (scheme: ColorScheme) => void = () => {}

function start(options: Record<string, unknown> = {}): HTMLImageElement {
  // Only what it reads.
  const context = {
    options,
    onColorScheme: (handler: (scheme: ColorScheme) => void) => {
      handler('light')
      setScheme = handler
    },
  }
  setup(context as unknown as PluginContext)

  const image = document.body.firstElementChild
  if (!(image instanceof HTMLImageElement)) throw new Error('no wallpaper laid')

  return image
}

describe('the wallpaper', () => {
  beforeEach(() => void document.body.replaceChildren(document.createElement('bbg-outlet')))

  it('goes under the page, fetched from the API with no referrer', () => {
    const image = start()

    expect(image.className).toBe('bbg-wallpaper')
    expect(image.src).toBe('https://api.paugram.com/wallpaper')
    expect(image.referrerPolicy).toBe('no-referrer')
    expect(image.nextElementSibling?.localName).toBe('bbg-outlet')
  })

  it('takes another API when the site names one', () => {
    expect(start({ api: 'https://example.com/random' }).src).toBe('https://example.com/random')
  })

  it('fades in once loaded, and leaves no trace when it fails', () => {
    const shown = start()
    shown.dispatchEvent(new Event('load'))
    expect(shown.classList.contains('is-loaded')).toBe(true)

    const failed = start()
    failed.dispatchEvent(new Event('error'))
    expect(failed.isConnected).toBe(false)
  })

  it('follows the colour scheme, to dim itself in the dark', () => {
    const image = start()
    expect(image.getAttribute('data-scheme')).toBe('light')

    setScheme('dark')
    expect(image.getAttribute('data-scheme')).toBe('dark')
  })
})

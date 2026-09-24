// @vitest-environment happy-dom
import type { ColorSchemeControl, ThemeContext } from '@bbg-next/view'
import { describe, expect, it } from 'vitest'
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

function marked(plugins: ThemeContext['plugins']): boolean {
  register({ colorScheme, seed: undefined, plugins })

  return document.documentElement.hasAttribute('data-wallpaper')
}

describe('dressing up for a plugin', () => {
  it('marks the page while a wallpaper lies under it, so the banner sets its text apart', () => {
    expect(marked([{ name: 'wallpaper', version: '0.1.0' }])).toBe(true)
    expect(marked([{ name: 'hitokoto', version: '0.1.0' }])).toBe(false)
  })
})

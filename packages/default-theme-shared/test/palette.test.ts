// @vitest-environment happy-dom
/// <reference types="node" />
import type { ColorScheme, ColorSchemeControl } from '@bbg-next/view'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { argbFromHex, Hct } from '@material/material-color-utilities'
import { describe, expect, it } from 'vitest'
import { paint } from '../src/palette.ts'

// From disk: vitest stubs CSS modules out, even under `?raw`.
const stylesheet = readFileSync(join(import.meta.dirname, '../src/style.css'), 'utf8')

/** Every colour slot style.css leaves for the palette to fill. */
const openSlots = [...stylesheet.matchAll(/--color-([\w-]+): transparent;/g)].map(match => match[1] ?? '')

interface Painted {
  readonly css: string
  /** What the browser's own bar is tinted. */
  readonly bar: string
}

function painted(seed: string): Record<ColorScheme, Painted> {
  document.head.replaceChildren()
  let show = (_scheme: ColorScheme): void => {}
  const colorScheme: ColorSchemeControl = {
    current: () => 'light',
    preference: () => 'auto',
    set: () => {},
    subscribe: handler => {
      show = handler
      handler('light')

      return () => {}
    },
  }
  paint(colorScheme, seed)

  const read = (scheme: ColorScheme): Painted => {
    show(scheme)

    return {
      css: document.getElementById('bbg-default-theme-palette')?.textContent ?? '',
      bar: document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.content ?? '',
    }
  }

  return { light: read('light'), dark: read('dark') }
}

function filled(css: string): string[] {
  return [...css.matchAll(/--color-([\w-]+):#[\da-f]{6};/g)].map(match => match[1] ?? '')
}

function slot(css: string, name: string): string {
  return new RegExp(`--color-${name}:(#[\\da-f]{6});`).exec(css)?.[1] ?? ''
}

describe('the palette', () => {
  it('fills every open slot, in both schemes', () => {
    const { light, dark } = painted('#e8590c')

    expect(openSlots.length).toBeGreaterThan(0)
    // an unfilled slot stays transparent, and an invisible bar is no error anyone would see
    expect(filled(light.css).sort()).toEqual([...openSlots].sort())
    expect(filled(dark.css).sort()).toEqual([...openSlots].sort())
  })

  it('puts the seed itself on the bar, and on the browser’s, in both schemes, as the original did', () => {
    const { light, dark } = painted('#0d6efd')

    expect([slot(light.css, 'bar'), light.bar]).toEqual(['#0d6efd', '#0d6efd'])
    expect([slot(dark.css, 'bar'), dark.bar]).toEqual(['#0d6efd', '#0d6efd'])
  })

  it('keeps a dark seed legible: white on the bar, and links that stay coloured', () => {
    const { light } = painted('#1b2a41')

    expect(slot(light.css, 'on-bar')).toBe('#ffffff')
    expect(Hct.fromInt(argbFromHex(slot(light.css, 'accent'))).tone).toBeCloseTo(40, 0)
  })
})

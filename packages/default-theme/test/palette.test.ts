/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { argbFromHex, Hct } from '@material/material-color-utilities'
import { describe, expect, it } from 'vitest'
import { palettes } from '../src/palette.ts'

// From disk: vitest stubs CSS modules out, even under `?raw`.
const stylesheet = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8')

/** Every colour slot style.css leaves for the palette to fill. */
const openSlots = [...stylesheet.matchAll(/--color-([\w-]+): transparent;/g)].map(match => match[1] ?? '')

function filled(css: string): string[] {
  return [...css.matchAll(/--color-([\w-]+):#[\da-f]{6};/g)].map(match => match[1] ?? '')
}

function slot(css: string, name: string): string {
  return new RegExp(`--color-${name}:(#[\\da-f]{6});`).exec(css)?.[1] ?? ''
}

describe('palettes', () => {
  it('fills every open slot, in both schemes', () => {
    const { light, dark } = palettes('#e8590c')

    expect(openSlots.length).toBeGreaterThan(0)
    // an unfilled slot stays transparent, and an invisible bar is no error anyone would see
    expect(filled(light).sort()).toEqual([...openSlots].sort())
    expect(filled(dark).sort()).toEqual([...openSlots].sort())
  })

  it('tells the browser which scheme each one is for', () => {
    const { light, dark } = palettes(undefined)

    expect(light).toContain('color-scheme:light')
    expect(dark).toContain('color-scheme:dark')
  })

  it('is the same for the same seed, and different for another', () => {
    expect(palettes('#e8590c')).toEqual(palettes('#e8590c'))
    expect(palettes('#e8590c')).not.toEqual(palettes('#2f9e44'))
  })

  it('puts the seed itself on the bar, in both schemes, as the original did', () => {
    const { light, dark } = palettes('#0d6efd')

    expect(slot(light, 'bar')).toBe('#0d6efd')
    expect(slot(dark, 'bar')).toBe('#0d6efd')
  })

  it('keeps a dark seed legible: white on the bar, and links that stay coloured', () => {
    const { light } = palettes('#1b2a41')

    expect(slot(light, 'on-bar')).toBe('#ffffff')
    expect(Hct.fromInt(argbFromHex(slot(light, 'accent'))).tone).toBeCloseTo(40, 0)
  })

  it('falls back to the original blue when the site sets no seed', () => {
    expect(palettes(undefined)).toEqual(palettes('#0d6efd'))
  })
})

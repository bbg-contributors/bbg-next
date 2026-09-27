// @vitest-environment happy-dom
import type { ColorScheme, ColorSchemeControl } from '@bbg-next/view'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createColorScheme } from '../src/scheme.ts'
import { stubQuery } from './stubQuery.ts'

function scheme(signal = new AbortController().signal): ColorSchemeControl {
  return createColorScheme(signal)
}

describe('createColorScheme', () => {
  beforeEach(() => void localStorage.clear())

  afterEach(() => void vi.unstubAllGlobals())

  it('resolves auto against the OS and follows it', () => {
    const set = stubQuery('light')
    const colorScheme = scheme()

    expect(colorScheme.preference()).toBe('auto')
    expect(colorScheme.current()).toBe('light')

    set('dark')
    expect(colorScheme.current()).toBe('dark')
  })

  it('lets a preference override the OS, and keeps it when the OS moves', () => {
    const set = stubQuery('light')
    const colorScheme = scheme()

    colorScheme.set('dark')
    expect(colorScheme.current()).toBe('dark')

    set('dark')
    set('light')
    expect(colorScheme.current()).toBe('dark')
  })

  it('goes back to following the OS on auto', () => {
    stubQuery('light')
    const colorScheme = scheme()

    colorScheme.set('dark')
    colorScheme.set('auto')

    expect(colorScheme.current()).toBe('light')
  })

  it('remembers the preference for the next visit', () => {
    stubQuery('light')
    scheme().set('dark')

    const colorScheme = scheme()
    expect(colorScheme.preference()).toBe('dark')
    expect(colorScheme.current()).toBe('dark')
  })

  describe('subscribe', () => {
    it('calls back with the scheme now, then on every change', () => {
      const set = stubQuery('light')
      const colorScheme = scheme()
      const seen: ColorScheme[] = []
      colorScheme.subscribe(next => void seen.push(next))

      set('dark')
      colorScheme.set('light')

      expect(seen).toEqual(['light', 'dark', 'light'])
    })

    it('stays quiet when the resolved scheme did not actually move', () => {
      const set = stubQuery('light')
      const colorScheme = scheme()
      const seen: ColorScheme[] = []
      colorScheme.subscribe(next => void seen.push(next))

      colorScheme.set('light')
      set('dark')

      expect(seen).toEqual(['light'])
    })

    it('hands back an unsubscribe that leaves the others alone', () => {
      const set = stubQuery('light')
      const colorScheme = scheme()
      const dropped: ColorScheme[] = []
      const kept: ColorScheme[] = []

      const unsubscribe = colorScheme.subscribe(next => void dropped.push(next))
      colorScheme.subscribe(next => void kept.push(next))

      unsubscribe()
      set('dark')

      expect(dropped).toEqual(['light'])
      expect(kept).toEqual(['light', 'dark'])
    })

    // A theme element subscribing on connect drops it again on disconnect, which can land mid-dispatch.
    it('survives a handler unsubscribing itself while being told', () => {
      const set = stubQuery('light')
      const colorScheme = scheme()
      const seen: ColorScheme[] = []

      // assigned after the fact: subscribe calls back before it returns
      let unsubscribe = (): void => {}
      unsubscribe = colorScheme.subscribe(next => {
        seen.push(next)
        unsubscribe()
      })

      expect(() => set('dark')).not.toThrow()
      set('light')

      expect(seen).toEqual(['light', 'dark'])
    })

    it('stops listening once its lifetime ends', () => {
      const set = stubQuery('light')
      const lifetime = new AbortController()
      const seen: ColorScheme[] = []
      scheme(lifetime.signal).subscribe(next => void seen.push(next))

      lifetime.abort()
      set('dark')

      expect(seen).toEqual(['light'])
    })
  })

  // Chrome throws on localStorage when site data is blocked, and that must not take the page down.
  it('carries on without storage, holding the preference for the tab', () => {
    stubQuery('light')
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    })

    const colorScheme = scheme()
    expect(colorScheme.preference()).toBe('auto')

    colorScheme.set('dark')
    expect(colorScheme.current()).toBe('dark')
  })
})

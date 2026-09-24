// @vitest-environment happy-dom
import type { ColorScheme } from '@bbg-next/view'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createColorScheme } from '../src/scheme.ts'

/** Returns a setter that flips what the OS reports and notifies, the way a browser would. */
function stubQuery(initial: ColorScheme): (next: ColorScheme) => void {
  const listeners = new Set<() => void>()
  const query = {
    matches: initial === 'dark',
    addEventListener: (_type: string, listener: () => void) => void listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => void listeners.delete(listener),
  }

  vi.stubGlobal('matchMedia', () => query)

  return next => {
    query.matches = next === 'dark'
    for (const listener of [...listeners]) listener()
  }
}

describe('createColorScheme', () => {
  beforeEach(() => void localStorage.clear())

  afterEach(() => void vi.unstubAllGlobals())

  it('resolves auto against the OS and follows it', () => {
    const set = stubQuery('light')
    const { colorScheme } = createColorScheme()

    expect(colorScheme.preference()).toBe('auto')
    expect(colorScheme.current()).toBe('light')

    set('dark')
    expect(colorScheme.current()).toBe('dark')
  })

  // Themes hear about the scheme through subscribe, never by reading it back off the page.
  it('keeps off the document', () => {
    const set = stubQuery('light')
    const before = document.documentElement.getAttributeNames()

    const { colorScheme } = createColorScheme()
    colorScheme.set('dark')
    set('dark')

    expect(document.documentElement.getAttributeNames()).toEqual(before)
  })

  it('lets a preference override the OS, and keeps it when the OS moves', () => {
    const set = stubQuery('light')
    const { colorScheme } = createColorScheme()

    colorScheme.set('dark')
    expect(colorScheme.current()).toBe('dark')

    set('dark')
    set('light')
    expect(colorScheme.current()).toBe('dark')
  })

  it('goes back to following the OS on auto', () => {
    stubQuery('light')
    const { colorScheme } = createColorScheme()

    colorScheme.set('dark')
    colorScheme.set('auto')

    expect(colorScheme.current()).toBe('light')
  })

  it('remembers the preference for the next visit', () => {
    stubQuery('light')
    createColorScheme().colorScheme.set('dark')

    const { colorScheme } = createColorScheme()
    expect(colorScheme.preference()).toBe('dark')
    expect(colorScheme.current()).toBe('dark')
  })

  describe('subscribe', () => {
    it('calls back with the scheme now, then on every change', () => {
      const set = stubQuery('light')
      const { colorScheme } = createColorScheme()
      const seen: ColorScheme[] = []
      colorScheme.subscribe(next => void seen.push(next))

      set('dark')
      colorScheme.set('light')

      expect(seen).toEqual(['light', 'dark', 'light'])
    })

    it('stays quiet when the resolved scheme did not actually move', () => {
      const set = stubQuery('light')
      const { colorScheme } = createColorScheme()
      const seen: ColorScheme[] = []
      colorScheme.subscribe(next => void seen.push(next))

      colorScheme.set('light')
      set('dark')

      expect(seen).toEqual(['light'])
    })

    it('hands back an unsubscribe that leaves the others alone', () => {
      const set = stubQuery('light')
      const { colorScheme } = createColorScheme()
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
      const { colorScheme } = createColorScheme()
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

    it('stops listening once torn down', () => {
      const set = stubQuery('light')
      const scheme = createColorScheme()
      const seen: ColorScheme[] = []
      scheme.colorScheme.subscribe(next => void seen.push(next))

      scheme.teardown()
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

    const { colorScheme } = createColorScheme()
    expect(colorScheme.preference()).toBe('auto')

    colorScheme.set('dark')
    expect(colorScheme.current()).toBe('dark')
  })
})

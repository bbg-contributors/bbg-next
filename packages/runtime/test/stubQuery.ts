import type { ColorScheme } from '@bbg-next/view'
import { vi } from 'vitest'

/** Stands in for the OS's colour scheme. Returns a setter that flips it and notifies, the way a browser would. */
export function stubQuery(initial: ColorScheme): (next: ColorScheme) => void {
  const listeners = new Set<() => void>()
  const query = {
    matches: initial === 'dark',
    addEventListener: (_type: string, listener: () => void) => void listeners.add(listener),
  }

  vi.stubGlobal('matchMedia', () => query)

  return next => {
    query.matches = next === 'dark'
    for (const listener of listeners) listener()
  }
}

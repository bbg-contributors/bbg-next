import type { ColorScheme, ColorSchemeControl, ColorSchemePreference } from '@bbg-next/view'

// Owned here rather than in the theme: plugins are told the scheme before a theme has even finished loading.

const storageKey = 'bbg-color-scheme'

// Blocked site data throws on access, and a colour preference is no reason to take the page down with it.
function read(): ColorSchemePreference {
  try {
    const stored = localStorage.getItem(storageKey)

    return stored === 'light' || stored === 'dark' ? stored : 'auto'
  } catch {
    return 'auto'
  }
}

function write(preference: ColorSchemePreference): void {
  try {
    localStorage.setItem(storageKey, preference)
  } catch {
    // nothing to do: the preference just will not outlive the tab
  }
}

export function createColorScheme(): ColorSchemeControl {
  const query = matchMedia('(prefers-color-scheme: dark)')
  const handlers = new Set<(scheme: ColorScheme) => void>()

  let preference = read()
  const current = (): ColorScheme => (preference === 'auto' ? (query.matches ? 'dark' : 'light') : preference)

  let published = current()

  const publish = (): void => {
    const next = current()
    if (next === published) return

    published = next
    // over a copy: a handler is free to unsubscribe itself, or another, while this runs
    for (const handler of [...handlers]) handler(next)
  }

  query.addEventListener('change', publish)

  return {
    current,
    preference: () => preference,

    set: next => {
      preference = next
      write(next)
      publish()
    },

    // Ahead of the add, so a handler that throws on its first call stays unsubscribed.
    subscribe: handler => {
      handler(current())
      handlers.add(handler)

      return () => void handlers.delete(handler)
    },
  }
}

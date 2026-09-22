import type { ColorScheme } from '@bbg-next/plugin'
import { definePlugin, injectStyle } from '@bbg-next/plugin'
import css from './style.css?inline'

// Its own colours, not the theme's: nothing here may depend on what a theme happens to inherit down.
const palette: Record<ColorScheme, string> = {
  light: ':root{--bbg-anchor-fg:#1a1a1a}',
  dark: ':root{--bbg-anchor-fg:#e8e8e8}',
}

// Walks the rendered DOM rather than hooking markdown, so it works for any renderer.

const headingSelector = 'h1, h2, h3, h4, h5, h6'

const separators = /\s+/g
const unsafe = /[^\p{L}\p{N}-]/gu
const hyphenRun = /-{2,}/g
const edgeHyphens = /^-+|-+$/g

/** Local rather than core's `slugify`, which would pull core into this bundle. */
function toId(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(separators, '-')
    .replace(unsafe, '')
    .replace(hyphenRun, '-')
    .replace(edgeHyphens, '')
}

export const setup = definePlugin(({ onRendered, onColorScheme }) => {
  onColorScheme(scheme => injectStyle('bbg-plugin-anchor', palette[scheme] + css))

  onRendered(({ element }) => {
    const byId = new Map<string, HTMLElement>()
    const undo: (() => void)[] = []

    for (const heading of element.querySelectorAll<HTMLElement>(headingSelector)) {
      const base = heading.id === '' ? toId(heading.textContent ?? '') : heading.id
      if (base === '') continue

      let id = base
      for (let n = 2; byId.has(id); n += 1) id = `${base}-${n}`
      byId.set(id, heading)
      heading.id = id

      const anchor = document.createElement('a')
      anchor.className = 'bbg-anchor'
      anchor.href = `#${id}`
      anchor.textContent = '#'
      anchor.setAttribute('aria-label', `Link to ${heading.textContent ?? id}`)

      const onClick = (event: MouseEvent): void => {
        // Otherwise the fragment replaces the route under hash routing. The runtime's own click handler checks defaultPrevented and stays out of the way.
        event.preventDefault()
        heading.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }

      anchor.addEventListener('click', onClick)
      undo.push(() => void anchor.removeEventListener('click', onClick))
      heading.append(anchor)
    }

    const wanted = decodeURIComponent(location.hash.slice(1))
    if (wanted !== '') byId.get(wanted)?.scrollIntoView()

    return () => {
      for (const remove of undo) remove()
    }
  })
})

import type { ColorScheme, ColorSchemeControl } from '@bbg-next/view'
import { injectStyle } from '@bbg-next/view'

function themeColorMeta(): HTMLMetaElement {
  const existing = document.querySelector('meta[name="theme-color"]')
  if (existing instanceof HTMLMetaElement) return existing

  const meta = document.createElement('meta')
  meta.name = 'theme-color'
  document.head.append(meta)

  return meta
}

/** Tints the browser chrome on mobile to match the bar, read back out of the palette just painted so the two cannot drift. */
function paintThemeColor(): void {
  const color = getComputedStyle(document.documentElement).getPropertyValue('--color-bar').trim()
  if (color !== '') themeColorMeta().content = color
}

/** Call once, after the main stylesheet is in. */
export function startAppearance(colorScheme: ColorSchemeControl, palette: Record<ColorScheme, string>): void {
  colorScheme.subscribe(scheme => {
    // A stylesheet of its own, outside every layer, so it beats the Tailwind theme whose slots it fills.
    injectStyle('bbg-default-theme-palette', palette[scheme])
    paintThemeColor()
  })
}

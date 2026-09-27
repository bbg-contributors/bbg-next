import type { ColorSchemeControl } from '@bbg-next/view'
import type { DynamicScheme } from '@material/material-color-utilities'
import { injectStyle } from '@bbg-next/view'
import { argbFromHex, DynamicColor, Hct, hexFromArgb, SchemeFidelity } from '@material/material-color-utilities'

const defaultSeed = '#0d6efd'

/** MD3 roles onto the slots style.css leaves open. As in the original, the bar is the seed itself in both schemes, and dark mode stays off near black. */
function slots(scheme: DynamicScheme): { readonly bar: number } & Readonly<Record<string, number>> {
  const dark = scheme.isDark
  const primary = scheme.primaryPalette
  // Not onPrimaryContainer: MD3 stops at 4.5:1, which leaves a dark seed's bar with dim text.
  const onBarTone = DynamicColor.tonePrefersLightForeground(Hct.fromInt(scheme.primaryContainer).tone) ? 100 : 10

  return {
    bar: scheme.primaryContainer,
    'on-bar': primary.tone(onBarTone),
    page: dark ? scheme.surfaceContainerLow : scheme.surface,
    surface: dark ? scheme.surfaceContainerHigh : scheme.surfaceContainerLowest,
    fg: scheme.onSurface,
    muted: scheme.onSurfaceVariant,
    // Not MD3's primary, which keeps its distance from the bar and so goes near black for a dark seed.
    accent: primary.tone(dark ? 80 : 40),
    'on-accent': primary.tone(dark ? 20 : 100),
    control: scheme.secondary,
    'on-control': scheme.onSecondary,
    line: scheme.outlineVariant,
    dash: scheme.outline,
    code: dark ? scheme.surfaceContainerHighest : scheme.surfaceContainer,
    picture: scheme.primaryFixedDim,
  }
}

function palette(source: Hct, dark: boolean): { readonly css: string; readonly bar: string } {
  const colors = slots(new SchemeFidelity(source, dark, 0))
  const declarations = Object.entries(colors).map(([slot, argb]) => `--color-${slot}:${hexFromArgb(argb)};`)

  return {
    css: `:root{color-scheme:${dark ? 'dark' : 'light'};--tag-lightness:${dark ? '74%' : '38%'};--wallpaper-brightness:${dark ? 0.4 : 1};${declarations.join('')}}`,
    bar: hexFromArgb(colors.bar),
  }
}

/** Both schemes at once, from the site's seed or this theme's own, painted as the scheme changes. */
export function paint(colorScheme: ColorSchemeControl, seed: string | undefined): void {
  const source = Hct.fromInt(argbFromHex(seed ?? defaultSeed))
  const palettes = { light: palette(source, false), dark: palette(source, true) }

  // Tints the browser chrome on mobile to match the bar.
  const themeColor = document.createElement('meta')
  themeColor.name = 'theme-color'
  document.head.append(themeColor)

  colorScheme.subscribe(scheme => {
    // A stylesheet of its own, outside every layer, so it beats the Tailwind theme whose slots it fills.
    injectStyle('bbg-default-theme-palette', palettes[scheme].css)
    themeColor.content = palettes[scheme].bar
  })
}

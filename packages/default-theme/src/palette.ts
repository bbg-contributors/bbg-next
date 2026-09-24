import type { ColorScheme } from '@bbg-next/view'
import type { DynamicScheme } from '@material/material-color-utilities'
// Held at 0.3: 0.4 ships extensionless relative imports, which neither Node nor `nodenext` resolve.
import { argbFromHex, DynamicColor, Hct, hexFromArgb, SchemeFidelity } from '@material/material-color-utilities'

const defaultSeed = '#0d6efd'

/** MD3 roles onto the slots style.css leaves open. As in the original, the bar is the seed itself in both schemes, and dark mode stays off near black. */
function slots(scheme: DynamicScheme): Record<string, number> {
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

function css(scheme: DynamicScheme): string {
  const declarations = Object.entries(slots(scheme)).map(([slot, argb]) => `--color-${slot}:${hexFromArgb(argb)};`)

  return `:root{color-scheme:${scheme.isDark ? 'dark' : 'light'};--tag-lightness:${scheme.isDark ? '74%' : '38%'};${declarations.join('')}}`
}

/** Both schemes at once, from the site's seed or this theme's own. */
export function palettes(seed: string | undefined): Record<ColorScheme, string> {
  const source = Hct.fromInt(argbFromHex(seed ?? defaultSeed))

  return {
    light: css(new SchemeFidelity(source, false, 0)),
    dark: css(new SchemeFidelity(source, true, 0)),
  }
}

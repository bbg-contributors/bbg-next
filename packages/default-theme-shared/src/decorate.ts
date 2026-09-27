import type { ThemeContext } from '@bbg-next/view'
import { paint } from './palette.ts'
import { ripples } from './ripple.ts'
import { layWallpaper } from './wallpaper.ts'

export function decorate(context: ThemeContext): void {
  paint(context.colorScheme, context.seed)
  ripples()
  const { wallpaper } = context.options
  if (typeof wallpaper === 'string') layWallpaper(wallpaper)
}

import type { ThemeContext } from '@bbg-next/view'
import { defineTheme } from '@bbg-next/view'
import { startAppearance } from './appearance.ts'
import { BbgArchiveView } from './elements/BbgArchiveView.ts'
import { BbgArticleList } from './elements/BbgArticleList.ts'
import { BbgArticleView } from './elements/BbgArticleView.ts'
import { createFooter } from './elements/BbgFooter.ts'
import { BbgNav } from './elements/BbgNav.ts'
import { BbgPageView } from './elements/BbgPageView.ts'
import { palettes } from './palette.ts'
import { ripples } from './ripple.ts'
import css from './style.css?inline'
import { layWallpaper } from './wallpaper.ts'

export function register(context: ThemeContext): void {
  defineTheme('bbg-default-theme', css, {
    header: BbgNav,
    footer: createFooter(context),
    articleList: BbgArticleList,
    archive: BbgArchiveView,
    article: BbgArticleView,
    page: BbgPageView,
  })

  startAppearance(context.colorScheme, palettes(context.seed))
  ripples()
  const { wallpaper } = context.options
  if (typeof wallpaper === 'string') layWallpaper(wallpaper)
}

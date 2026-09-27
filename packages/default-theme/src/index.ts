import type { ThemeContext } from '@bbg-next/view'
import { decorate } from '@bbg-next/default-theme-shared'
import { defineTheme } from '@bbg-next/view'
import { BbgArchiveView } from './elements/BbgArchiveView.ts'
import { BbgArticleList } from './elements/BbgArticleList.ts'
import { BbgArticleView } from './elements/BbgArticleView.ts'
import { BbgFooter } from './elements/BbgFooter.ts'
import { BbgNav } from './elements/BbgNav.ts'
import { BbgPageView } from './elements/BbgPageView.ts'
import { tools } from './elements/tools.ts'
import css from './style.css?inline'

export function register(context: ThemeContext): void {
  defineTheme('bbg-default-theme', css, {
    header: BbgNav,
    footer: BbgFooter,
    articleList: BbgArticleList,
    archive: BbgArchiveView,
    article: BbgArticleView,
    page: BbgPageView,
  })

  decorate(context)
  document.body.append(tools(context.colorScheme))
}

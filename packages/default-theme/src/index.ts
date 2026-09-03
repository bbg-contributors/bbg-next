import { defineTheme } from '@bbg-next/view'
import { BbgArticleList } from './elements/BbgArticleList.ts'
import { BbgArticleView } from './elements/BbgArticleView.ts'
import { BbgFooter } from './elements/BbgFooter.ts'
import { BbgNav } from './elements/BbgNav.ts'
import { BbgPageView } from './elements/BbgPageView.ts'
import css from './style.css?inline'

export const register = defineTheme('bbg-default-theme', css, {
  header: BbgNav,
  footer: BbgFooter,
  articleList: BbgArticleList,
  article: BbgArticleView,
  page: BbgPageView,
})

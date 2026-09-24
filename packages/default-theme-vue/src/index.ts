import type { ThemeContext } from '@bbg-next/view'
import { defineTheme, injectStyle } from '@bbg-next/view'
import { defineCustomElement } from 'vue'
import BbgArchiveView from './components/BbgArchiveView.vue'
import BbgArticleList from './components/BbgArticleList.vue'
import BbgArticleView from './components/BbgArticleView.vue'
import BbgFooter from './components/BbgFooter.vue'
import BbgNav from './components/BbgNav.vue'
import BbgPageView from './components/BbgPageView.vue'
import dark from './dark.css?inline'
import css from './style.css?inline'

// shadowRoot: false keeps the views in light DOM, so one stylesheet covers the page too.
const lightDom = { shadowRoot: false } as const

// oxlint-disable typescript/no-unsafe-argument -- oxlint cannot type .vue imports; vue-tsc does
export function register(context: ThemeContext): void {
  defineTheme('bbg-default-theme-vue', css, {
    header: defineCustomElement(BbgNav, lightDom),
    footer: defineCustomElement(BbgFooter, lightDom),
    articleList: defineCustomElement(BbgArticleList, lightDom),
    archive: defineCustomElement(BbgArchiveView, lightDom),
    article: defineCustomElement(BbgArticleView, lightDom),
    page: defineCustomElement(BbgPageView, lightDom),
  })

  // After the main stylesheet, so this one wins.
  context.colorScheme.subscribe(
    scheme => void injectStyle('bbg-default-theme-vue-scheme', scheme === 'dark' ? dark : ''),
  )
}

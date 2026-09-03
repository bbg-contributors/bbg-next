import { defineTheme } from '@bbg-next/view'
import { defineCustomElement } from 'vue'
import BbgArticleList from './components/BbgArticleList.vue'
import BbgArticleView from './components/BbgArticleView.vue'
import BbgFooter from './components/BbgFooter.vue'
import BbgNav from './components/BbgNav.vue'
import BbgPageView from './components/BbgPageView.vue'
import css from './style.css?inline'

// shadowRoot: false keeps the views in light DOM, so one stylesheet covers the page too.
const lightDom = { shadowRoot: false } as const

// oxlint-disable typescript/no-unsafe-argument -- oxlint cannot type .vue imports; vue-tsc does
export const register = defineTheme('bbg-default-theme-vue', css, {
  header: defineCustomElement(BbgNav, lightDom),
  footer: defineCustomElement(BbgFooter, lightDom),
  articleList: defineCustomElement(BbgArticleList, lightDom),
  article: defineCustomElement(BbgArticleView, lightDom),
  page: defineCustomElement(BbgPageView, lightDom),
})

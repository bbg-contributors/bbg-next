import type { ThemeContext } from '@bbg-next/view'
import { decorate } from '@bbg-next/default-theme-shared'
import { defineTheme } from '@bbg-next/view'
import { createApp, defineCustomElement } from 'vue'
import BbgArchiveView from './components/BbgArchiveView.vue'
import BbgArticleList from './components/BbgArticleList.vue'
import BbgArticleView from './components/BbgArticleView.vue'
import BbgFooter from './components/BbgFooter.vue'
import BbgNav from './components/BbgNav.vue'
import BbgPageView from './components/BbgPageView.vue'
import Tools from './components/Tools.vue'
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

  decorate(context)
  const tools = document.createElement('div')
  document.body.append(tools)
  createApp(Tools, { colorScheme: context.colorScheme }).mount(tools)
}

import type { MarkdownApi } from '@bbg-next/plugin'
import { definePlugin, injectStyle } from '@bbg-next/plugin'
import dark from 'highlight.js/styles/github-dark.css?inline'
import light from 'highlight.js/styles/github.css?inline'
import css from './style.css?inline'

let colourer: Promise<typeof import('./colour.ts')> | undefined

/** Wraps a code block, and colours it once highlight.js is in: only a page that shows code sends for it. */
class BbgHighlight extends HTMLElement {
  #done = false

  connectedCallback(): void {
    const code = this.querySelector('pre > code')
    if (this.#done || !(code instanceof HTMLElement)) return
    this.#done = true

    colourer ??= import('./colour.ts')
    colourer
      .then(({ colour }) => colour(code))
      .catch((cause: unknown) => console.error('bbg-next: cannot colour code', cause))
  }
}

export const setup = definePlugin(context => {
  injectStyle('bbg-plugin-highlight', css)
  // highlight.js's own GitHub themes, whose `.hljs` background never applies: blocks keep the theme's own.
  context.onColorScheme(scheme => injectStyle('bbg-plugin-highlight-palette', scheme === 'dark' ? dark : light))
  customElements.define('bbg-highlight', BbgHighlight)

  const { rules } = context.require<MarkdownApi>('markdown').renderer
  const fence = rules['fence']
  rules['fence'] = (...args) => `<bbg-highlight data-bbg-plugin="highlight">${fence?.(...args) ?? ''}</bbg-highlight>\n`
})

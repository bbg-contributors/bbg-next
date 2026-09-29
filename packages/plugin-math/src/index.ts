import type { MarkdownApi } from '@bbg-next/plugin'
import { definePlugin, injectStyle } from '@bbg-next/plugin'
import { tex } from '@mdit/plugin-tex'
import css from './style.css?inline'

let typesetter: Promise<typeof import('./typeset.ts')> | undefined

/** Holds a formula's TeX, swapped for MathML once Temml is in: only a page that shows a formula sends for it. Until then, or should that fail, the TeX itself shows. */
class BbgMath extends HTMLElement {
  #done = false

  connectedCallback(): void {
    if (this.#done) return
    this.#done = true

    typesetter ??= import('./typeset.ts')
    typesetter
      .then(({ typeset }) => typeset(this))
      .catch((cause: unknown) => console.error('bbg-next: cannot typeset a formula', cause))
  }
}

export const setup = definePlugin(context => {
  injectStyle('bbg-plugin-math', css)
  customElements.define('bbg-math', BbgMath)

  const md = context.require<MarkdownApi>('markdown')
  md.use(tex, {
    render: (content: string, display: boolean) =>
      display
        ? `<bbg-math data-bbg-plugin="math" display>${md.utils.escapeHtml(content)}</bbg-math>\n`
        : `<bbg-math data-bbg-plugin="math">${md.utils.escapeHtml(content)}</bbg-math>`,
  })
})

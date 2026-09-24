import type { ShellModel, ThemeContext } from '@bbg-next/view'
import { el, ModelElement } from './base.ts'
import { container } from './layout.ts'
import { tools } from './tools.ts'

/** A class per registration: the footer carries the floating controls, and those need the runtime's handle. */
export function createFooter(context: ThemeContext): CustomElementConstructor {
  return class BbgFooter extends ModelElement<ShellModel> {
    readonly #text = el('footer', 'border-t border-fg/5 pt-4 pb-8 text-muted [&_a]:text-accent [&_a]:underline')
    readonly #column = container(this.#text)

    // The floating controls are made once and stay, an open dialog included.
    protected override build(): void {
      this.replaceChildren(this.#column, tools(context))
    }

    // Only the text follows the model.
    protected override update(model: ShellModel): void {
      if (!this.changed('text', model.footerHtml)) return

      this.#text.innerHTML = model.footerHtml
      this.#column.hidden = model.footerHtml === ''
    }
  }
}

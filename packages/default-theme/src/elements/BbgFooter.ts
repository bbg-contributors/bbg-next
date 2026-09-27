import type { ShellModel } from '@bbg-next/view'
import { el, ModelElement } from './base.ts'
import { container } from './layout.ts'

export class BbgFooter extends ModelElement<ShellModel> {
  readonly #text = el('footer', 'border-t border-fg/5 pt-4 pb-8 text-muted [&_a]:text-accent [&_a]:underline')
  readonly #column = container(this.#text)

  protected override build(): void {
    this.append(this.#column)
  }

  // Only the text follows the model.
  protected override update(model: ShellModel): void {
    if (!this.changed('text', model.footerHtml)) return

    this.#text.innerHTML = model.footerHtml
    this.#column.hidden = model.footerHtml === ''
  }
}

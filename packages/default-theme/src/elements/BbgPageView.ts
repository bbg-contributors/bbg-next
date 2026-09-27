import type { PageModel } from '@bbg-next/view'
import { el, ModelElement } from './base.ts'
import { banner, enter, main, retitle } from './layout.ts'

export class BbgPageView extends ModelElement<PageModel> {
  readonly #banner = banner()
  // Tighter than an article's, as the original's pages were.
  readonly #content = el('div', 'bbg-content my-7.5 rounded-md bg-surface p-4 shadow-card')
  readonly #main = main(this.#content)

  protected override build(): void {
    this.append(this.#banner, this.#main)
  }

  protected override update(model: PageModel): void {
    if (this.changed('title', model.title)) retitle(this.#banner, model.title)

    if (this.changed('html', model.html)) {
      this.#content.innerHTML = model.html
      enter(this.#main)
    }
  }
}

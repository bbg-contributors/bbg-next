import type { PageModel } from '@bbg-next/view'
import { ModelElement } from './base.ts'
import { banner, enter, main, pageCard, retitle } from './layout.ts'

export class BbgPageView extends ModelElement<PageModel> {
  readonly #banner = banner()
  readonly #content = pageCard()
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

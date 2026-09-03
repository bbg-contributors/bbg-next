import type { PageModel } from '@bbg-next/view'
import { el, ModelElement } from './base.ts'

export class BbgPageView extends ModelElement<PageModel> {
  protected override update(model: PageModel): void {
    const content = el('div', 'bbg-content')
    content.innerHTML = model.html

    this.replaceChildren(el('h1', 'bbg-page-title', model.title), content)
  }
}

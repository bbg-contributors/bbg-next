import type { ShellModel } from '@bbg-next/view'
import { el, ModelElement } from './base.ts'

export class BbgFooter extends ModelElement<ShellModel> {
  protected override update(model: ShellModel): void {
    if (model.footerHtml === '') {
      this.replaceChildren()

      return
    }

    const footer = el('footer', 'bbg-site-footer')
    footer.innerHTML = model.footerHtml
    this.replaceChildren(footer)
  }
}

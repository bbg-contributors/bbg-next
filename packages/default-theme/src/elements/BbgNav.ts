import type { ShellModel } from '@bbg-next/view'
import { el, link, ModelElement } from './base.ts'

export class BbgNav extends ModelElement<ShellModel> {
  protected override update(model: ShellModel): void {
    const header = el('header', 'bbg-site-header')

    const title = el('h1', 'bbg-site-title')
    title.append(link(model.homeHref, model.title))
    header.append(title)

    if (model.description !== '') {
      header.append(el('p', 'bbg-site-description', model.description))
    }

    if (model.links.length > 0) {
      const nav = el('nav', 'bbg-site-nav')
      for (const item of model.links) nav.append(link(item.href, item.label))
      header.append(nav)
    }

    this.replaceChildren(header)
  }
}

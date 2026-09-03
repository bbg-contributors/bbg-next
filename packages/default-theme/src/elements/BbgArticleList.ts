import type { ArticleListModel } from '@bbg-next/view'
import { el, link, ModelElement } from './base.ts'
import { metaRow } from './meta.ts'

export class BbgArticleList extends ModelElement<ArticleListModel> {
  protected override update(model: ArticleListModel): void {
    const fragment = document.createDocumentFragment()

    if (model.articles.length === 0) {
      fragment.append(el('p', 'bbg-empty', 'No articles yet.'))
    }

    for (const card of model.articles) {
      const item = el('article', 'bbg-card')

      const heading = el('h2', 'bbg-card-title')
      heading.append(link(card.href, card.title))
      item.append(heading, metaRow(card))

      if (card.excerpt !== '') item.append(el('p', 'bbg-card-excerpt', card.excerpt))

      fragment.append(item)
    }

    if (model.totalPages > 1) {
      const pagination = el('nav', 'bbg-pagination')
      for (const page of model.pageLinks) {
        const anchor = link(page.href, String(page.page))
        if (page.current) anchor.setAttribute('aria-current', 'page')
        pagination.append(anchor)
      }
      fragment.append(pagination)
    }

    this.replaceChildren(fragment)
  }
}

import type { ArticleModel } from '@bbg-next/view'
import { el, ModelElement } from './base.ts'
import { metaRow } from './meta.ts'

export class BbgArticleView extends ModelElement<ArticleModel> {
  protected override update(model: ArticleModel): void {
    const fragment = document.createDocumentFragment()
    fragment.append(
      el('h1', 'bbg-article-title', model.title),
      metaRow({ created: model.created, tags: model.tags, pinned: false }),
    )

    if (model.unlisted) {
      const badge = el('p')
      badge.append(el('span', 'bbg-unlisted', 'Unlisted'))
      fragment.append(badge)
    }

    const content = el('div', 'bbg-content')
    content.innerHTML = model.html
    fragment.append(content)

    this.replaceChildren(fragment)
  }
}

import type { Labels } from '../labels.ts'
import type { ArticleModel } from '@bbg-next/view'
import { labels } from '../labels.ts'
import { el, ModelElement } from './base.ts'
import { articleCard, banner, enter, main, retitle } from './layout.ts'
import { metaRow } from './meta.ts'

function below(model: ArticleModel, t: Labels): Node[] {
  const nodes: Node[] = []
  if (model.unlisted) {
    nodes.push(
      el(
        'span',
        'bbg-unlisted mb-2 inline-block rounded border border-dashed border-current px-2 text-xs text-muted',
        t.unlisted,
      ),
    )
  }
  nodes.push(metaRow(model, t))

  return nodes
}

export class BbgArticleView extends ModelElement<ArticleModel> {
  readonly #banner = banner()
  readonly #content = articleCard()
  readonly #main = main(this.#content)

  protected override build(): void {
    this.append(this.#banner, this.#main)
  }

  protected override update(model: ArticleModel): void {
    // All the banner shows, so it is filled again only when one of them differs.
    const heading = [model.title, model.created, model.updated, model.tags, model.unlisted]
    if (this.changed('banner', heading)) retitle(this.#banner, model.title, ...below(model, labels()))

    if (this.changed('html', model.html)) {
      this.#content.innerHTML = model.html
      enter(this.#main)
    }
  }
}

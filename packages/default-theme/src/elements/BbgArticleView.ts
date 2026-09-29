import type { Labels } from '@bbg-next/default-theme-shared'
import type { ArticleLink, ArticleModel } from '@bbg-next/view'
import { enter, labels } from '@bbg-next/default-theme-shared'
import { ArrowLeft, ArrowRight } from 'lucide'
import { el, icon, link, ModelElement } from './base.ts'
import { banner, main, retitle } from './layout.ts'
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

/** One side of the way on, as the original drew it: a card with its label over the neighbour's title, or word there is none. */
function neighbour(side: ArticleLink | null, rel: 'prev' | 'next', label: (Node | string)[], t: Labels): HTMLElement {
  const card = el(
    'div',
    rel === 'next' ? 'rounded-md bg-surface p-4 text-right shadow-card' : 'rounded-md bg-surface p-4 shadow-card',
  )
  const heading = el('div', 'mb-2 text-sm font-medium text-muted')
  heading.append(...label)

  const title = el('div', 'text-xl font-medium')
  if (side === null) {
    title.textContent = t.nothing
  } else {
    const anchor = link(side.href, side.title, 'text-accent underline hover:text-accent-hover')
    anchor.rel = rel
    title.append(anchor)
  }

  card.append(heading, title)

  return card
}

export class BbgArticleView extends ModelElement<ArticleModel> {
  readonly #banner = banner()
  readonly #content = el('div', 'bbg-content my-7.5 rounded-md bg-surface px-[4%] py-7.5 shadow-card')
  readonly #neighbours = el('nav', 'bbg-neighbours my-7.5 grid grid-cols-2 gap-6')
  readonly #main = main(this.#content, this.#neighbours)

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

    if (this.changed('neighbours', [model.previous, model.next, model.unlisted])) {
      const t = labels()
      // An unlisted article sits in no order, so it has no way on.
      this.#neighbours.hidden = model.unlisted
      this.#neighbours.replaceChildren(
        ...(model.unlisted
          ? []
          : [
              neighbour(model.previous, 'prev', [icon(ArrowLeft), ` ${t.previous}`], t),
              neighbour(model.next, 'next', [`${t.next} `, icon(ArrowRight)], t),
            ]),
      )
    }
  }
}

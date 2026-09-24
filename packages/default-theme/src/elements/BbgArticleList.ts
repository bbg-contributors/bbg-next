import type { Labels } from '../labels.ts'
import type { ArticleCard, ArticleListModel, PageLink } from '@bbg-next/view'
import { Pin } from 'lucide'
import { labels } from '../labels.ts'
import { el, icon, link, markCurrent, ModelElement } from './base.ts'
import { enter, main } from './layout.ts'
import { metaRow } from './meta.ts'

function title(entry: ArticleCard): HTMLElement {
  const heading = el('h2', 'bbg-card-title mb-2 fs-2 leading-[1.2] font-medium')
  heading.append(
    link(
      entry.href,
      entry.title,
      'relative text-accent before:absolute before:inset-x-0 before:bottom-0 before:h-0.5 before:scale-x-0 before:bg-accent before:transition-transform before:duration-300 hover:text-accent-hover hover:before:scale-x-100',
    ),
  )

  return heading
}

function card(entry: ArticleCard, t: Labels): HTMLElement {
  const item = el('article', 'bbg-card my-7.5 rounded-md bg-surface p-5 shadow-card')

  // Set apart the way the original set pinned articles apart: a label and the title, nothing else.
  if (entry.pinned) {
    const pin = el('div', 'text-muted')
    pin.append(icon(Pin), ` ${t.pinned}`)
    item.append(pin, title(entry))
  } else {
    item.append(title(entry), metaRow(entry, t))
    if (entry.excerpt !== '') item.append(el('p', 'mt-6 mb-4', entry.excerpt))
  }

  return item
}

function pageLink(page: PageLink): HTMLAnchorElement {
  return link(
    page.href,
    String(page.page),
    'ripple rounded-[.2rem] border border-transparent px-2 py-1 text-sm text-accent underline transition-colors hover:text-accent-hover aria-[current=page]:border-control aria-[current=page]:bg-control aria-[current=page]:text-on-control aria-[current=page]:no-underline',
  )
}

export class BbgArticleList extends ModelElement<ArticleListModel> {
  readonly #cards = el('div')
  readonly #pages = el('nav', 'bbg-pagination flex flex-wrap gap-1')
  readonly #count = el('p', 'mt-6 mb-4 text-muted')
  readonly #main = main(this.#cards, this.#pages, this.#count)

  protected override build(): void {
    this.append(this.#main)
  }

  protected override update(model: ArticleListModel): void {
    const t = labels()

    if (this.changed('cards', model.articles)) {
      this.#cards.replaceChildren(
        ...(model.articles.length === 0
          ? [el('p', 'py-12 text-muted', t.empty)]
          : model.articles.map(entry => card(entry, t))),
      )
      enter(this.#main)
    }

    // From one page of the list to the next, only the mark moves.
    const hrefs = model.pageLinks.map(page => page.href)
    if (this.changed('pages', hrefs)) this.#pages.replaceChildren(...model.pageLinks.map(pageLink))
    markCurrent(this.#pages.children, model.pageLinks)

    const count = t.pageOf(model.page, model.totalPages)
    if (this.#count.textContent !== count) this.#count.textContent = count
    this.#pages.hidden = model.totalPages <= 1
    this.#count.hidden = model.totalPages <= 1
  }
}

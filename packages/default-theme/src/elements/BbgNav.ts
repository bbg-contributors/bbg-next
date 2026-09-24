import type { ShellModel } from '@bbg-next/view'
import { Menu } from 'lucide'
import { labels } from '../labels.ts'
import { el, iconButton, link, markCurrent, ModelElement } from './base.ts'
import { container, hero } from './layout.ts'

// Flush with the title when folded into the menu, as Bootstrap's navbar sets them. The mark under the current one grows in and out as the reader moves.
function navLink(href: string, label: string): HTMLAnchorElement {
  return link(
    href,
    label,
    'ripple block py-2.5 transition-colors after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:scale-x-0 after:bg-on-bar after:transition-transform after:duration-300 hover:bg-bar-hover aria-[current=page]:after:scale-x-100 lg:px-2',
  )
}

export class BbgNav extends ModelElement<ShellModel> {
  /** In the order of the model's marks: the article list, the archive, then the pages. */
  #links: HTMLAnchorElement[] = []

  protected override update(model: ShellModel): void {
    const { title, description, home, archive, links } = model
    // All the bar is built from but the marks, which are all a navigation moves.
    const outline = [title, description, home.href, archive.href, links.map(({ label, href }) => [label, href])]
    if (this.changed('bar', outline)) this.#drawBar(model)

    markCurrent(this.#links, [home, archive, ...links])
  }

  #drawBar(model: ShellModel): void {
    const t = labels()

    const home = navLink(model.home.href, t.articles)
    const archive = navLink(model.archive.href, t.archive)
    const pages = model.links.map(entry => navLink(entry.href, entry.label))
    this.#links = [home, archive, ...pages]

    const site = el('nav', 'bbg-site-nav flex flex-col lg:flex-row')
    site.append(...pages)

    const menu = el('div', 'hidden basis-full flex-col pb-2 data-open:flex lg:flex lg:basis-auto lg:flex-row lg:pb-0')
    menu.append(home, archive, site)

    const bar = el('div', 'flex flex-wrap items-center px-3')
    bar.append(
      link(model.home.href, model.title, 'mr-4 py-2.5 font-bold'),
      iconButton('ml-auto cursor-pointer rounded px-3 py-1 text-xl lg:hidden', t.menu, Menu, () => {
        menu.toggleAttribute('data-open')
      }),
      menu,
    )
    // The bar stays on screen past the page a link leads to, so the menu folds away on the way there.
    bar.addEventListener('click', event => {
      if (event.target instanceof Element && event.target.closest('a') !== null) menu.removeAttribute('data-open')
    })

    const header = el('header', 'fixed inset-x-0 top-0 z-10 bg-bar text-on-bar shadow-bar')
    header.append(bar)

    const banner =
      model.description === '' ? hero(model.title) : hero(model.title, el('p', 'mb-4 text-xl', model.description))

    this.replaceChildren(header, container(banner))
  }
}

import type { ShellAction, ShellModel } from '@bbg-next/view'
import { labels } from '@bbg-next/default-theme-shared'
import { Menu } from 'lucide'
import { el, iconButton, link, markCurrent, ModelElement } from './base.ts'
import { banner, container, retitle } from './layout.ts'

// Flush with the title when folded into the menu, as Bootstrap's navbar sets them. The mark under the current one grows in and out as the reader moves.
function navLink(href: string, label: string): HTMLAnchorElement {
  return link(
    href,
    label,
    'ripple block py-2.5 transition-colors after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:scale-x-0 after:bg-on-bar after:transition-transform after:duration-300 hover:bg-bar-hover aria-[current=page]:after:scale-x-100 lg:px-2',
  )
}

// Outlined and spaced as the original's search button was.
function actionButton({ label, icon, run }: ShellAction, fold: () => void): HTMLButtonElement {
  const glyph = el('span', '*:inline-block *:size-[1em] *:align-[-0.125em]')
  glyph.setAttribute('aria-hidden', 'true')
  glyph.innerHTML = icon

  const button = el(
    'button',
    'ripple mt-2 -mb-1 cursor-pointer rounded border border-on-bar px-3 py-1.5 transition-colors hover:bg-bar-hover lg:my-0',
  )
  button.type = 'button'
  button.append(glyph, ` ${label}`)
  button.addEventListener('click', () => {
    fold()
    run()
  })

  return button
}

export class BbgNav extends ModelElement<ShellModel> {
  /** In the order of the model's marks: the article list, the archive, then the pages. */
  #links: HTMLAnchorElement[] = []

  protected override update(model: ShellModel): void {
    const { title, description, home, archive, links, actions } = model
    // All the bar is built from but the marks, which are all a navigation moves.
    const outline = [
      title,
      description,
      home.href,
      archive.href,
      links.map(({ label, href }) => [label, href]),
      actions.map(({ label, icon }) => [label, icon]),
    ]
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

    const menu = el(
      'div',
      'hidden basis-full flex-col pb-2 data-open:flex lg:flex lg:grow lg:basis-auto lg:flex-row lg:pb-0',
    )
    const fold = (): void => menu.removeAttribute('data-open')

    const actions = el('div', 'flex items-center lg:mr-1 lg:ml-auto')
    actions.append(...model.actions.map(action => actionButton(action, fold)))

    menu.append(home, archive, site, actions)

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
      if (event.target instanceof Element && event.target.closest('a') !== null) fold()
    })

    const header = el('header', 'fixed inset-x-0 top-0 z-10 bg-bar text-on-bar shadow-bar')
    header.append(bar)

    const hero = banner()
    retitle(hero, model.title, ...(model.description === '' ? [] : [el('p', 'mb-4 text-xl', model.description)]))

    this.replaceChildren(header, container(hero))
  }
}

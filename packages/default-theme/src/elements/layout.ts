import { el } from './base.ts'

/** The narrow centred column, for what sits outside a view: the shell's banner and the footer. */
export function container(...children: Node[]): HTMLElement {
  const wrapper = el('div', 'column')
  wrapper.append(...children)

  return wrapper
}

/** A view's own content. */
export function main(...children: Node[]): HTMLElement {
  const wrapper = el('main')
  wrapper.append(...children)

  return wrapper
}

/** The slide-in the original played on every navigation, played here over content that has just changed. */
export function enter(node: HTMLElement): void {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return

  node.animate({ opacity: [0, 1], translate: ['-20px', '0'] }, { duration: 800, easing: 'ease' })
}

/** The banner a view opens with, carrying its `h1`. It has no fill of its own: the page's ground, or a wallpaper, shows through. */
export function banner(): HTMLElement {
  return el('div', 'bbg-hero pt-13 pb-12')
}

/** Fills a banner with what it now heads, for one that stays on screen as that changes. */
export function retitle(box: HTMLElement, title: string | Node, ...below: Node[]): void {
  const heading = el('h1', 'mb-2 text-[50px] leading-[1.2] font-medium')
  heading.append(title)
  box.replaceChildren(heading, ...below)
}

export function hero(title: string | Node, ...below: Node[]): HTMLElement {
  const box = banner()
  retitle(box, title, ...below)

  return box
}

/** Rendered markdown, in an article's card. */
export function articleCard(): HTMLElement {
  return el('div', 'bbg-content my-7.5 rounded-md bg-surface px-[4%] py-7.5 shadow-card')
}

/** Tighter than an article's, as the original's pages were. */
export function pageCard(): HTMLElement {
  return el('div', 'bbg-content my-7.5 rounded-md bg-surface p-4 shadow-card')
}

/** A page's card, holding the theme's own markup rather than rendered markdown. */
export function panel(...children: Node[]): HTMLElement {
  const box = el('div', 'my-7.5 rounded-md bg-surface p-4 shadow-card')
  box.append(...children)

  return box
}

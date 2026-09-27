import { el } from './base.ts'

/** The narrow centred column, for what sits outside a view: the shell's banner and the footer. */
export function container(...children: Node[]): HTMLElement {
  const wrapper = el('div', 'column')
  wrapper.append(...children)

  return wrapper
}

export function main(...children: Node[]): HTMLElement {
  const wrapper = el('main')
  wrapper.append(...children)

  return wrapper
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

/** A page's card, holding the theme's own markup rather than rendered markdown. */
export function panel(...children: Node[]): HTMLElement {
  const box = el('div', 'my-7.5 rounded-md bg-surface p-4 shadow-card')
  box.append(...children)

  return box
}

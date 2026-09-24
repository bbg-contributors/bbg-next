// Light DOM on purpose: one stylesheet then covers the page and the rendered markdown alike.

import type { IconNode } from 'lucide'
import { createElement } from 'lucide'

export abstract class ModelElement<Model> extends HTMLElement {
  #model: Model | undefined
  #built = false
  readonly #drawn = new Map<string, string>()

  set model(value: Model) {
    this.#model = value
    if (this.isConnected) this.#draw(value)
  }

  get model(): Model | undefined {
    return this.#model
  }

  connectedCallback(): void {
    if (this.#model !== undefined) this.#draw(this.#model)
  }

  #draw(model: Model): void {
    if (!this.#built) {
      this.#built = true
      this.build()
    }
    this.update(model)
  }

  /** The markup that stays, put up once before the first model is drawn. */
  protected build(): void {}

  protected abstract update(model: Model): void

  /** Whether `part` differs from what it was last drawn from, so an element redraws only what changed. */
  protected changed(part: string, value: unknown): boolean {
    // Wrapped, or a part whose value is `undefined` would not encode.
    const now = JSON.stringify([value])
    if (this.#drawn.get(part) === now) return false

    this.#drawn.set(part, now)

    return true
  }
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (className !== undefined) node.className = className
  if (text !== undefined) node.textContent = text

  return node
}

export function link(href: string, text: string, className?: string): HTMLAnchorElement {
  const anchor = el('a', className, text)
  anchor.href = href

  return anchor
}

/** Marks the one of `anchors` that leads to what is on screen, in the order `links` come. */
export function markCurrent(anchors: Iterable<Element>, links: readonly { readonly current: boolean }[]): void {
  for (const [index, anchor] of [...anchors].entries()) {
    if (links[index]?.current === true) anchor.setAttribute('aria-current', 'page')
    else anchor.removeAttribute('aria-current')
  }
}

/** Sized in `em` so it rides along with whatever text it sits next to. */
export function icon(node: IconNode): SVGElement {
  return createElement(node, {
    class: 'inline-block shrink-0 align-[-0.125em]',
    width: '1em',
    height: '1em',
    'aria-hidden': 'true',
  })
}

export function iconButton(className: string, label: string, node: IconNode, onClick: () => void): HTMLButtonElement {
  const button = el('button', `ripple ${className}`)
  button.type = 'button'
  button.title = label
  button.setAttribute('aria-label', label)
  button.append(icon(node))
  button.addEventListener('click', onClick)

  return button
}

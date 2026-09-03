// Light DOM on purpose: one stylesheet then covers the page and the rendered markdown alike.

export abstract class ModelElement<Model> extends HTMLElement {
  #model: Model | undefined

  set model(value: Model) {
    this.#model = value
    if (this.isConnected) this.update(value)
  }

  get model(): Model | undefined {
    return this.#model
  }

  connectedCallback(): void {
    if (this.#model !== undefined) this.update(this.#model)
  }

  protected abstract update(model: Model): void
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

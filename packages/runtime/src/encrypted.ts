import type { Wording } from './wording.ts'
import { decrypt, encryptedElement } from '@bbg-next/core'

interface Host {
  /** Renders decrypted markdown the way the document on screen renders its own. */
  readonly render: (markdown: string) => string
  readonly words: Wording
}

/** Swapped on every `define`, since the element can be defined only once per page but `start` may run again. */
let host: Host

function line(className: string, text: string): HTMLSpanElement {
  const span = document.createElement('span')
  span.className = className
  span.textContent = text

  return span
}

class BbgEncrypted extends HTMLElement {
  #drawn = false

  connectedCallback(): void {
    if (this.#drawn) return
    this.#drawn = true

    const t = host.words

    const input = document.createElement('input')
    input.type = 'password'
    input.required = true
    input.placeholder = t.password
    input.setAttribute('aria-label', t.password)

    const button = document.createElement('button')
    button.type = 'submit'
    button.className = 'bbg-button'
    button.textContent = t.unlock

    const error = line('bbg-encrypted-error', '')
    error.hidden = true
    error.setAttribute('role', 'alert')

    const form = document.createElement('form')
    form.className = 'bbg-encrypted-form'
    form.append(line('bbg-encrypted-notice', t.locked), input, button, error)

    const unlock = async (): Promise<void> => {
      button.disabled = true

      let markdown: string | null
      try {
        markdown = await decrypt(this.dataset['source'] ?? '', input.value)
      } catch (cause) {
        console.error('bbg-next: cannot read an encrypted block', cause)
        error.textContent = t.damaged
        error.hidden = false
        input.disabled = true

        return
      }

      if (markdown === null) {
        error.textContent = t.wrongPassword
        error.hidden = false
        button.disabled = false
        input.select()

        return
      }

      this.innerHTML = host.render(markdown)
    }

    form.addEventListener('submit', event => {
      event.preventDefault()
      void unlock()
    })

    this.replaceChildren(form)
  }
}

export function defineEncrypted(next: Host): void {
  host = next
  if (customElements.get(encryptedElement) === undefined) customElements.define(encryptedElement, BbgEncrypted)
}

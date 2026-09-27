import type { ThemeElements } from '@bbg-next/view'
import { defineTheme, themeElements } from '@bbg-next/view'

// Just enough of a theme to boot the runtime: every element takes its model, and a view shows its html.
function element(): CustomElementConstructor {
  return class extends HTMLElement {
    #model: unknown

    get model(): unknown {
      return this.#model
    }

    set model(value: { readonly html?: string }) {
      this.#model = value
      if (value.html !== undefined) this.innerHTML = value.html
    }
  }
}

export function register(): void {
  defineTheme(
    'bbg-stub-theme',
    '',
    Object.fromEntries(Object.keys(themeElements).map(slot => [slot, element()])) as ThemeElements,
  )
}

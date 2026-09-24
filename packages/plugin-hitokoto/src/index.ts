import type { ColorScheme } from '@bbg-next/plugin'
import { definePlugin, injectStyle, readString, readStrings } from '@bbg-next/plugin'
import css from './style.css?inline'

// The fallbacks behind the shared tokens: nothing here may depend on what a theme happens to inherit down.
const palette: Record<ColorScheme, string> = {
  light: ':root{--bbg-hitokoto-fg:#1a1a1a;--bbg-hitokoto-rule:#6b6b6b;--bbg-hitokoto-bg:rgba(0,0,0,0.04)}',
  dark: ':root{--bbg-hitokoto-fg:#e8e8e8;--bbg-hitokoto-rule:#9a9a9a;--bbg-hitokoto-bg:rgba(255,255,255,0.05)}',
}

interface Quote {
  readonly hitokoto?: unknown
  readonly from?: unknown
  readonly from_who?: unknown
}

function attribution(quote: Quote): string {
  const who = typeof quote.from_who === 'string' ? quote.from_who.trim() : ''
  const work = typeof quote.from === 'string' && quote.from.trim() !== '' ? `《${quote.from.trim()}》` : ''
  const parts = [who, work].filter(part => part !== '')

  return parts.length === 0 ? '' : `—— ${parts.join(' ')}`
}

export const setup = definePlugin(({ options, onRendered, onColorScheme }) => {
  onColorScheme(scheme => injectStyle('bbg-plugin-hitokoto', palette[scheme] + css))

  const endpoint = new URL(readString(options, 'api', 'https://v1.hitokoto.cn/'))
  for (const category of readStrings(options, 'categories', [])) endpoint.searchParams.append('c', category)

  const routes = readStrings(options, 'routes', ['home'])

  // One quote for as long as the reader stays on views that show it.
  let shown: HTMLElement | null = null
  let fetching = new AbortController()

  const quote = (): HTMLElement => {
    const box = document.createElement('figure')
    box.className = 'bbg-hitokoto'

    const controller = new AbortController()
    fetching = controller

    void (async () => {
      try {
        const response = await fetch(endpoint, { signal: controller.signal })
        if (!response.ok) throw new Error(`${response.status} from ${endpoint.host}`)

        const said = (await response.json()) as Quote
        if (typeof said.hitokoto !== 'string' || said.hitokoto === '') throw new Error('no quote in the response')

        // textContent, not innerHTML: this is somebody else's server talking.
        const text = document.createElement('blockquote')
        text.textContent = said.hitokoto
        box.append(text)

        const credit = attribution(said)
        if (credit !== '') {
          const caption = document.createElement('figcaption')
          caption.textContent = credit
          box.append(caption)
        }

        box.classList.add('is-loaded')
      } catch {
        // Decoration: leave no trace rather than an empty frame or an error on the page, and try again on the next view.
        if (!controller.signal.aborted) {
          box.remove()
          shown = null
        }
      }
    })()

    return box
  }

  onRendered(({ element, route }) => {
    if (!routes.includes(route.type)) {
      fetching.abort()
      shown?.remove()
      shown = null

      return
    }

    shown ??= quote()
    if (shown.parentElement !== element) element.prepend(shown)
  })
})

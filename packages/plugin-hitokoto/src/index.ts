import type { ColorScheme } from '@bbg-next/plugin'
import { definePlugin, injectStyle, readString, readStrings } from '@bbg-next/plugin'
import css from './style.css?inline'

// Its own colours, not the theme's: nothing here may depend on what a theme happens to inherit down.
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

  onRendered(({ element, route }) => {
    if (!routes.includes(route.type)) return

    const box = document.createElement('figure')
    box.className = 'bbg-hitokoto'
    element.prepend(box)

    const controller = new AbortController()

    void (async () => {
      try {
        const response = await fetch(endpoint, { signal: controller.signal })
        if (!response.ok) throw new Error(`${response.status} from ${endpoint.host}`)

        const quote = (await response.json()) as Quote
        if (typeof quote.hitokoto !== 'string' || quote.hitokoto === '') throw new Error('no quote in the response')

        // textContent, not innerHTML: this is somebody else's server talking.
        const text = document.createElement('blockquote')
        text.textContent = quote.hitokoto
        box.append(text)

        const credit = attribution(quote)
        if (credit !== '') {
          const caption = document.createElement('figcaption')
          caption.textContent = credit
          box.append(caption)
        }

        box.classList.add('is-loaded')
      } catch {
        // Decoration: leave no trace rather than an empty frame or an error on the page.
        if (!controller.signal.aborted) box.remove()
      }
    })()

    return () => controller.abort()
  })
})

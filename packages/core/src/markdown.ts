import type { Env, MarkdownIt, StateCore, Token } from 'markdown-it'
import createMarkdownIt from 'markdown-it'

export interface RenderContext {
  /** Directory the document lives in, e.g. `data/articles/`. Relative links resolve against it. */
  readonly baseUrl?: string
}

const absoluteHref = /^[a-z][a-z0-9+.-]*:|^\/\/|^[#?]/i

/** Stays relative, which is what makes a non-root `base` work. */
export function resolveHref(href: string, baseUrl: string | undefined): string {
  if (href === '' || baseUrl === undefined || baseUrl === '') return href
  if (absoluteHref.test(href) || href.startsWith('/')) return href

  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`

  return `${base}${href}`
}

function resolveTokens(tokens: readonly Token[], baseUrl: string): void {
  for (const token of tokens) {
    const attr = token.type === 'image' ? 'src' : token.type === 'link_open' ? 'href' : undefined
    if (attr !== undefined) {
      const value = token.attrGet(attr)
      if (typeof value === 'string') token.attrSet(attr, resolveHref(value, baseUrl))
    }
    // images and links sit in an inline token's children
    if (token.children !== null) resolveTokens(token.children, baseUrl)
  }
}

/** One instance per site, not a module singleton, so plugins can `use()` it before the first render. */
export function createMarkdown(): MarkdownIt {
  // html: false is load-bearing — no raw HTML means no sanitiser to ship.
  const md = createMarkdownIt({ html: false, linkify: true })

  // A core rule, not a renderer rule: a plugin replacing `renderer.rules.image` would drop this.
  md.core.ruler.push('bbg_resolve_href', (state: StateCore) => {
    const baseUrl = (state.env as RenderContext | undefined)?.baseUrl
    if (baseUrl === undefined || baseUrl === '') return

    resolveTokens(state.tokens, baseUrl)
  })

  return md
}

export function renderMarkdown(md: MarkdownIt, source: string, context: RenderContext = {}): string {
  return md.render(source, context as Env)
}

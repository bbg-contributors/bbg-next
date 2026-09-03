import type { Env } from 'markdown-it'
import MarkdownIt from 'markdown-it'

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

// html: false is load-bearing — no raw HTML means no sanitiser to ship.
const md = new MarkdownIt({ html: false, linkify: true })

for (const [rule, attr] of [
  ['image', 'src'],
  ['link_open', 'href'],
] as const) {
  const previous = md.renderer.rules[rule]

  md.renderer.rules[rule] = (tokens, idx, options, env, self) => {
    const token = tokens[idx]
    const baseUrl = (env as RenderContext | undefined)?.baseUrl
    if (token !== undefined) {
      const index = token.attrIndex(attr)
      const value = index >= 0 ? token.attrs?.[index]?.[1] : undefined
      // Attribute values are `string | number`; only a string can be a path worth resolving.
      if (typeof value === 'string') token.attrSet(attr, resolveHref(value, baseUrl))
    }

    return previous === undefined ? self.renderToken(tokens, idx, options) : previous(tokens, idx, options, env, self)
  }
}

export function renderMarkdown(source: string, context: RenderContext = {}): string {
  return md.render(source, context as Env)
}

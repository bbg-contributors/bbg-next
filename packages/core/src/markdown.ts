import type { Env, MarkdownIt, StateCore, Token } from 'markdown-it'
import createMarkdownIt from 'markdown-it'
import { slugify } from './content/slug.ts'

export interface RenderContext {
  /** Directory the document lives in, e.g. `data/articles/`. Relative links resolve against it. */
  readonly baseUrl?: string
  /** Where the document is shown, e.g. `#/post/hello`. Fragment links resolve against it, and only a document with one gets heading permalinks. */
  readonly href?: string
}

const absoluteHref = /^[a-z][a-z0-9+.-]*:|^\/\/|^\?/i

/** Stays relative, which is what makes a non-root `base` work. A fragment goes after the document's href: on its own, `<base>` would take it to the site root and hash routing would read it as a route. */
export function resolveHref(target: string, { baseUrl, href }: RenderContext): string {
  if (target.startsWith('#')) return href === undefined ? target : `${href}${target}`
  if (target === '' || baseUrl === undefined || baseUrl === '') return target
  if (absoluteHref.test(target) || target.startsWith('/')) return target

  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`

  return `${base}${target}`
}

function resolveTokens(tokens: readonly Token[], context: RenderContext): void {
  for (const token of tokens) {
    const attr = token.type === 'image' ? 'src' : token.type === 'link_open' ? 'href' : undefined
    if (attr !== undefined) {
      const value = token.attrGet(attr)
      if (typeof value === 'string') token.attrSet(attr, resolveHref(value, context))
    }
    // images and links sit in an inline token's children
    if (token.children !== null) resolveTokens(token.children, context)
  }
}

function textOf(children: readonly Token[]): string {
  return children
    .filter(child => child.type === 'text' || child.type === 'code_inline')
    .map(child => child.content)
    .join('')
}

/** An empty link, so the theme alone decides what it looks like. An id a plugin already gave the heading is kept. */
function addPermalinks(state: StateCore): void {
  const taken = new Set<string>()

  for (const [index, inline] of state.tokens.entries()) {
    const heading = state.tokens[index - 1]
    if (heading?.type !== 'heading_open' || inline.children === null) continue

    const own = heading.attrGet('id')
    const base = typeof own === 'string' ? own : slugify(textOf(inline.children))
    if (base === '') continue

    let id = base
    for (let n = 2; taken.has(id); n += 1) id = `${base}-${n}`
    taken.add(id)
    heading.attrSet('id', id)

    const open = new state.Token('link_open', 'a', 1)
    open.attrs = [
      ['class', 'bbg-anchor'],
      ['href', `#${encodeURIComponent(id)}`],
      ['aria-labelledby', id],
    ]
    inline.children.unshift(open, new state.Token('link_close', 'a', -1))
  }
}

/** A `bbg-` custom element's name, which is all a fence's info string may hold to become one. */
const elementName = /^bbg-[a-z\d]+(?:-[a-z\d]+)*$/

/** Whoever defines the element draws it, reading the fence's content from `data-source`, and in `data-base` the directory the document's own relative links resolve against. Until then it shows nothing. */
function fencesToElements(state: StateCore): void {
  const { escapeHtml } = state.md.utils
  const baseUrl = (state.env as RenderContext | undefined)?.baseUrl ?? ''
  const base = baseUrl === '' ? '' : ` data-base="${escapeHtml(baseUrl)}"`

  for (const token of state.tokens) {
    const name = token.info.trim()
    if (token.type !== 'fence' || !elementName.test(name)) continue

    token.type = 'html_block'
    token.content = `<${name} data-source="${escapeHtml(token.content)}"${base}></${name}>\n`
  }
}

/** One instance per site, not a module singleton, so plugins can `use()` it before the first render. */
export function createMarkdown(): MarkdownIt {
  // html: false is load-bearing — no raw HTML means no sanitiser to ship.
  const md = createMarkdownIt({ html: false, linkify: true })

  // Core rules, not renderer rules: a plugin replacing `renderer.rules.image` would drop them. Permalinks go first, so their hrefs get resolved too.
  md.core.ruler.push('bbg_permalinks', (state: StateCore) => {
    if ((state.env as RenderContext | undefined)?.href !== undefined) addPermalinks(state)
  })
  md.core.ruler.push('bbg_resolve_href', (state: StateCore) => {
    resolveTokens(state.tokens, (state.env as RenderContext | undefined) ?? {})
  })
  md.core.ruler.push('bbg_elements', fencesToElements)

  return md
}

export function renderMarkdown(md: MarkdownIt, source: string, context: RenderContext = {}): string {
  return md.render(source, context as Env)
}

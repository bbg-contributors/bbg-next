import type { Route, RouterConfig } from './route.ts'
import type { Env, MarkdownIt, StateCore, Token } from 'markdown-it'
import { tasklist } from '@mdit/plugin-tasklist'
import createMarkdownIt from 'markdown-it'
import { slugify } from './content/slug.ts'
import { parse, parseFragment } from './route.ts'

export interface RenderContext extends Env {
  /** Directory the document lives in, with a trailing slash, e.g. `data/articles/`. Relative links resolve against it. */
  readonly baseUrl?: string
  /** Where the document is shown, e.g. `#/article/hello`. Fragment links resolve against it, and only a document with one gets heading permalinks. */
  readonly href?: string
}

/** Where another view is, on a site routed by hash. */
type ViewHref = (route: Route, fragment: string) => string

const absoluteHref = /^(?:[a-z][a-z\d+.-]*:|[/?])/i
const hashRouting: RouterConfig = { mode: 'hash', base: '/' }

/** Stays relative, which is what makes a non-root `base` work. A fragment goes after the document's href: on its own, `<base>` would take it to the site root and hash routing would read it as a route. */
function resolveHref(target: string, { baseUrl = '', href }: RenderContext, viewHref: ViewHref | undefined): string {
  // No heading's id holds a slash, so this is another view rather than a place in this one.
  if (viewHref !== undefined && target.startsWith('#/')) {
    const named = { pathname: '/', hash: target }
    const route = parse(named, hashRouting)

    return route === null ? target : viewHref(route, parseFragment(named, hashRouting))
  }
  if (target.startsWith('#')) return href === undefined ? target : `${href}${target}`
  if (target === '' || absoluteHref.test(target)) return target

  return `${baseUrl}${target}`
}

function resolveTokens(tokens: readonly Token[], context: RenderContext, viewHref: ViewHref | undefined): void {
  for (const token of tokens) {
    const attr = token.type === 'image' ? 'src' : token.type === 'link_open' ? 'href' : undefined
    if (attr !== undefined) {
      const value = token.attrGet(attr)
      if (typeof value === 'string') token.attrSet(attr, resolveHref(value, context, viewHref))
    }
    if (token.children !== null) resolveTokens(token.children, context, viewHref)
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
function fencesToElements(state: StateCore, baseUrl: string): void {
  const { escapeHtml } = state.md.utils
  const base = baseUrl === '' ? '' : ` data-base="${escapeHtml(baseUrl)}"`

  for (const token of state.tokens) {
    const name = token.info.trim()
    if (token.type !== 'fence' || !elementName.test(name)) continue

    token.type = 'html_block'
    token.content = `<${name} data-source="${escapeHtml(token.content)}"${base}></${name}>\n`
  }
}

/** One instance per site, not a module singleton, so plugins can `use()` it before the first render. A hash-routed site names another view as its address bar shows it, `#/article/x`, and `viewHref` writes out where that is; without one, as on a site routed by path, `#/article/x` is a place in the document like any other fragment. */
export function createMarkdown(viewHref?: ViewHref): MarkdownIt {
  // html: false is load-bearing — no raw HTML means no sanitiser to ship.
  const md = createMarkdownIt({ html: false, linkify: true }).use(tasklist, {
    label: false,
    containerClass: 'bbg-task-list',
    itemClass: 'bbg-task',
    checkboxClass: 'bbg-task-checkbox',
  })

  // A core rule, not a renderer rule: a plugin replacing `renderer.rules.image` would drop it. Permalinks go first, so their hrefs get resolved too.
  md.core.ruler.push('bbg', state => {
    const context = state.env as RenderContext
    if (context.href !== undefined) addPermalinks(state)
    resolveTokens(state.tokens, context, viewHref)
    fencesToElements(state, context.baseUrl ?? '')
  })

  return md
}

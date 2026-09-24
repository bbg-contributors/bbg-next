// One segment grammar for both modes: [] | ['list', n] | ['post', slug] | ['page', slug] | ['archive'] | ['tag', name]. `list` is separate from `page` because `#/page/2` collides with a page slugged `2`.

export type Route =
  | { readonly type: 'home'; readonly page: number }
  | { readonly type: 'article'; readonly slug: string }
  | { readonly type: 'page'; readonly slug: string }
  | { readonly type: 'archive' }
  | { readonly type: 'tag'; readonly tag: string }

export interface RouterConfig {
  readonly mode: 'hash' | 'path'
  /** Path prefix the site is served under. Only meaningful in `path` mode. */
  readonly base: string
}

/** To the `/…/` shape the rest of this module assumes. */
export function normaliseBase(base: string): string {
  const trimmed = base.trim()
  if (trimmed === '' || trimmed === '/') return '/'
  const withLead = trimmed.startsWith('/') ? trimmed : `/${trimmed}`

  return withLead.endsWith('/') ? withLead : `${withLead}/`
}

const pageNumber = /^[1-9]\d*$/

function toSegments(route: Route): string[] {
  switch (route.type) {
    case 'home':
      return route.page <= 1 ? [] : ['list', String(route.page)]
    case 'article':
      return ['post', route.slug]
    case 'page':
      return ['page', route.slug]
    case 'archive':
      return ['archive']
    case 'tag':
      return ['tag', route.tag]
  }
}

function fromSegments(segments: readonly string[]): Route | null {
  if (segments.length === 0) return { type: 'home', page: 1 }
  if (segments.length === 1) return segments[0] === 'archive' ? { type: 'archive' } : null

  const [head, tail] = segments
  if (segments.length !== 2 || head === undefined || tail === undefined || tail === '') return null

  switch (head) {
    case 'list': {
      if (!pageNumber.test(tail)) return null

      return { type: 'home', page: Number(tail) }
    }
    case 'post':
      return { type: 'article', slug: tail }
    case 'page':
      return { type: 'page', slug: tail }
    case 'tag':
      return { type: 'tag', tag: tail }
    default:
      return null
  }
}

function splitPath(path: string): string[] {
  return path.split('/').filter(segment => segment !== '')
}

/** Hash hrefs are document-relative by design. `fragment` is an element id within the document. */
export function serialize(route: Route, config: RouterConfig, fragment = ''): string {
  const encoded = toSegments(route).map(segment => encodeURIComponent(segment))
  const href =
    config.mode === 'hash'
      ? `#/${encoded.join('/')}`
      : `${normaliseBase(config.base)}${encoded.map(segment => `${segment}/`).join('')}`

  return fragment === '' ? href : `${href}#${encodeURIComponent(fragment)}`
}

function decodeSegment(segment: string | undefined): string | null {
  if (segment === undefined) return null
  try {
    return decodeURIComponent(segment)
  } catch {
    return null
  }
}

function decodeSegments(segments: readonly string[]): Route | null {
  const decoded: string[] = []
  for (const segment of segments) {
    const value = decodeSegment(segment)
    if (value === null) return null
    decoded.push(value)
  }

  return fromSegments(decoded)
}

/** Satisfied by both `URL` and `location`, so core needs neither DOM nor Node types. */
export interface Locationish {
  readonly pathname: string
  readonly hash: string
}

/** The route's part of the URL, then the document's fragment. `hash` mode spends the URL's own fragment on the route, so there the document's follows a second `#`. */
function split(url: Locationish, config: RouterConfig): readonly [path: string, fragment: string] {
  const hash = url.hash.startsWith('#') ? url.hash.slice(1) : url.hash
  if (config.mode === 'path') return [url.pathname, hash]

  const at = hash.indexOf('#')

  return at === -1 ? [hash, ''] : [hash.slice(0, at), hash.slice(at + 1)]
}

/** `null` when outside the site or off-grammar — callers render a 404. */
export function parse(url: Locationish, config: RouterConfig): Route | null {
  const [path] = split(url, config)
  if (config.mode === 'hash') return decodeSegments(splitPath(path))

  // Split before decoding: a `%2F` inside a slug would otherwise become a real separator.
  const baseSegments = splitPath(normaliseBase(config.base))
  const pathSegments = splitPath(path)
  if (pathSegments.length < baseSegments.length) return null

  for (const [index, expected] of baseSegments.entries()) {
    if (decodeSegment(pathSegments[index]) !== expected) return null
  }

  return decodeSegments(pathSegments.slice(baseSegments.length))
}

/** The id of the element the URL points at within the document, `''` for none. */
export function parseFragment(url: Locationish, config: RouterConfig): string {
  return decodeSegment(split(url, config)[1]) ?? ''
}

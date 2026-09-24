// The runtime/theme contract. The runtime fetches, routes and renders markdown; a theme only draws.

export interface NavLink {
  readonly label: string
  readonly href: string
  /** Leads to what is on screen, so a theme can mark it. */
  readonly current: boolean
}

/** A view every site has, as opposed to a page. Unlabelled: what to call it is the theme's wording. */
export interface ViewLink {
  readonly href: string
  readonly current: boolean
}

/** Sent again whenever it changes, as the `current` flags follow the reader. The shell stays on screen throughout, so update only what differs rather than drawing it anew. */
export interface ShellModel {
  readonly title: string
  readonly description: string
  /** Already rendered from markdown. */
  readonly footerHtml: string
  /** The article list, current on every page of it rather than only the first. */
  readonly home: ViewLink
  /** Current on a tag's page too, which is the archive narrowed to one tag. */
  readonly archive: ViewLink
  readonly links: readonly NavLink[]
}

export interface TagLink {
  readonly name: string
  /** The tag's page. */
  readonly href: string
}

export interface ArticleCard {
  readonly slug: string
  readonly title: string
  readonly excerpt: string
  readonly tags: readonly TagLink[]
  readonly created: number
  readonly updated: number
  readonly pinned: boolean
  readonly href: string
}

export interface PageLink {
  readonly page: number
  readonly href: string
  readonly current: boolean
}

export interface ArticleListModel {
  readonly articles: readonly ArticleCard[]
  readonly page: number
  readonly totalPages: number
  readonly pageLinks: readonly PageLink[]
}

/** The archive, or one tag's page of it. Grouping the articles, by year or by tag, is the theme's call. */
export interface ArchiveModel {
  /** Set on a tag's page, and then `articles` holds only those carrying it. */
  readonly tag: string | null
  /** Newest first: pinning plays no part here. */
  readonly articles: readonly ArticleCard[]
}

export interface ArticleModel {
  readonly title: string
  readonly tags: readonly TagLink[]
  readonly created: number
  readonly updated: number
  /** Safe to insert: rendered with raw HTML disabled. A markdown heading opens with an empty `a.bbg-anchor` permalink, left for the theme to draw, and a fence named after a `bbg-` element comes out as that element. */
  readonly html: string
  /** So a theme can mark it unlisted. */
  readonly unlisted: boolean
}

export interface PageModel {
  readonly title: string
  /** Rendered as an article's is. */
  readonly html: string
}

export type ColorScheme = 'light' | 'dark'

/** `auto` follows the operating system. */
export type ColorSchemePreference = ColorScheme | 'auto'

/** The runtime owns the scheme, since it tells the plugins too. A theme drives and watches it through this rather than keeping its own. */
export interface ColorSchemeControl {
  /** What the page is painted as, with `auto` already resolved. */
  readonly current: () => ColorScheme
  readonly preference: () => ColorSchemePreference
  readonly set: (preference: ColorSchemePreference) => void
  /** Called with the scheme now, and again on every change. Returns an unsubscribe. */
  readonly subscribe: (handler: (scheme: ColorScheme) => void) => () => void
}

/** A plugin that set up without failing, for a theme that dresses up to go with it. */
export interface PluginInfo {
  readonly name: string
  readonly version: string
}

/** Whatever a theme cannot work out on its own. */
export interface ThemeContext {
  readonly colorScheme: ColorSchemeControl
  /** The site's brand colour as `#rrggbb`, if it set one. How it becomes a palette is entirely the theme's call. */
  readonly seed: string | undefined
  /** In load order. */
  readonly plugins: readonly PluginInfo[]
}

/** The runtime calls `register()` exactly once. Set whichever shared tokens you can on `:root` so plugins, and the runtime's own password box, blend in: `--bbg-fg`, `--bbg-muted`, `--bbg-accent`, `--bbg-on-accent`, `--bbg-bg`, `--bbg-surface`, `--bbg-border`, `--bbg-radius` and `--bbg-shadow`. To fit a plugin closer, set the `--bbg-<plugin>-*` properties it documents, or repeat one of its selectors under an element of your own, unlayered, like `bbg-outlet .bbg-friend`: the extra element outranks the plugin's rule whichever stylesheet loads first. Buttons the runtime and plugins draw carry `bbg-button`, for you to restyle the same way or add effects to. */
export interface ThemeModule {
  readonly register: (context: ThemeContext) => void
}

/** Header and footer both take a `ShellModel`. A view's element stays on screen from one view of its kind to the next and is handed each new model, so update only what differs, and leave alone what plugins have put into it. Hyphens are required by the HTML spec. */
export const themeElements = {
  header: 'bbg-nav',
  footer: 'bbg-footer',
  articleList: 'bbg-article-list',
  archive: 'bbg-archive-view',
  article: 'bbg-article-view',
  page: 'bbg-page-view',
} as const

export type ThemeElements = Record<keyof typeof themeElements, CustomElementConstructor>

/** Keyed on `id`: calling it again replaces that stylesheet in place, which is how a theme repaints. */
export function injectStyle(id: string, css: string): void {
  const existing = document.getElementById(id)
  if (existing !== null) {
    existing.textContent = css

    return
  }

  const style = document.createElement('style')
  style.id = id
  style.textContent = css
  document.head.append(style)
}

/** What a theme's `register` calls. Idempotent: both the stylesheet and the definitions need guarding. */
export function defineTheme(styleId: string, css: string, elements: ThemeElements): void {
  injectStyle(styleId, css)

  for (const slot of Object.keys(elements) as (keyof ThemeElements)[]) {
    const tag = themeElements[slot]
    if (customElements.get(tag) === undefined) customElements.define(tag, elements[slot])
  }
}

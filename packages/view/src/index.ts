// The runtime/theme contract. The runtime fetches, routes and renders markdown; a theme only draws.

export interface NavLink {
  readonly label: string
  readonly href: string
}

/** Rendered once, reused across route changes. */
export interface ShellModel {
  readonly title: string
  readonly description: string
  /** Already rendered from markdown. */
  readonly footerHtml: string
  readonly homeHref: string
  readonly links: readonly NavLink[]
}

export interface ArticleCard {
  readonly slug: string
  readonly title: string
  readonly excerpt: string
  readonly tags: readonly string[]
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

export interface ArticleModel {
  readonly title: string
  readonly tags: readonly string[]
  readonly created: number
  readonly updated: number
  /** Safe to insert: rendered with raw HTML disabled. */
  readonly html: string
  /** So a theme can mark it unlisted. */
  readonly unlisted: boolean
}

export interface PageModel {
  readonly title: string
  readonly html: string
}

/** The runtime calls `register()` exactly once. */
export interface ThemeModule {
  readonly register: () => void
}

/** Header and footer both take a `ShellModel`. Hyphens are required by the HTML spec. */
export const themeElements = {
  header: 'bbg-nav',
  footer: 'bbg-footer',
  articleList: 'bbg-article-list',
  article: 'bbg-article-view',
  page: 'bbg-page-view',
} as const

export type ThemeElements = Record<keyof typeof themeElements, CustomElementConstructor>

/** Builds the `register` a theme exports. Idempotent: both the stylesheet and the definitions need guarding. */
export function defineTheme(styleId: string, css: string, elements: ThemeElements): () => void {
  return () => {
    if (document.getElementById(styleId) === null) {
      const style = document.createElement('style')
      style.id = styleId
      style.textContent = css
      document.head.append(style)
    }

    for (const slot of Object.keys(elements) as (keyof ThemeElements)[]) {
      const tag = themeElements[slot]
      if (customElements.get(tag) === undefined) customElements.define(tag, elements[slot])
    }
  }
}

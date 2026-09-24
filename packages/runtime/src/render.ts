import type { Site } from './site.ts'
import type { ArticleEntry, PageEntry, RenderContext, Route } from '@bbg-next/core'
import type {
  ArchiveModel,
  ArticleCard,
  ArticleListModel,
  ArticleModel,
  PageLink,
  PageModel,
  TagLink,
} from '@bbg-next/view'
import { articlesDir, pagesDir, serializeRoute, stripFrontMatter } from '@bbg-next/core'
import { themeElements } from '@bbg-next/view'
import { fetchText } from './site.ts'

interface Shown {
  readonly title: string
  /** What the document on screen was rendered against, for markdown that turns up in it later. */
  readonly context: RenderContext
}

/** A theme's view, and the model to hand it. */
interface Found extends Shown {
  readonly tag: string
  readonly model: unknown
  readonly comments: boolean
}

/** The runtime's own not-found view, which holds nothing for plugins to work on. */
interface Missing extends Shown {
  readonly tag: null
  readonly message: string
}

export type Rendered = Found | Missing

/** A property, not an attribute: an attribute would stringify the model. */
export function setModel(element: HTMLElement, model: unknown): void {
  Object.assign(element, { model })
}

export function mount(tag: string, model: unknown): HTMLElement {
  const element = document.createElement(tag)
  setModel(element, model)

  return element
}

/** Puts `rendered` into `view`. The element already there stays if it is of the same kind, handed the new model, so the theme changes only what differs. */
export function place(view: HTMLElement, rendered: Rendered): HTMLElement {
  const current = view.firstElementChild
  const kept = current instanceof HTMLElement && current.localName === (rendered.tag ?? 'div') ? current : null

  if (rendered.tag === null) {
    const element = kept ?? document.createElement('div')
    element.className = 'bbg-not-found'
    if (element.textContent !== rendered.message) element.textContent = rendered.message
    if (kept === null) view.replaceChildren(element)

    return element
  }

  if (kept !== null) {
    setModel(kept, rendered.model)

    return kept
  }

  const element = mount(rendered.tag, rendered.model)
  view.replaceChildren(element)

  return element
}

function tagLinks(site: Site, tags: readonly string[]): TagLink[] {
  return tags.map(name => ({ name, href: serializeRoute({ type: 'tag', tag: name }, site.router) }))
}

function toCard(site: Site, entry: ArticleEntry): ArticleCard {
  return {
    slug: entry.slug,
    title: entry.title,
    excerpt: entry.excerpt,
    tags: tagLinks(site, entry.tags),
    created: entry.created,
    updated: entry.updated,
    pinned: entry.pinned,
    href: serializeRoute({ type: 'article', slug: entry.slug }, site.router),
  }
}

function buildList(site: Site, page: number): ArticleListModel | null {
  const { articles, site: settings } = site.manifest
  const perPage = settings.postsPerPage
  const totalPages = Math.max(1, Math.ceil(articles.length / perPage))
  if (page < 1 || page > totalPages) return null

  const start = (page - 1) * perPage
  const pageLinks: PageLink[] = Array.from({ length: totalPages }, (_unused, index) => {
    const n = index + 1

    return {
      page: n,
      current: n === page,
      href: serializeRoute({ type: 'home', page: n }, site.router),
    }
  })

  return {
    page,
    totalPages,
    pageLinks,
    articles: articles.slice(start, start + perPage).map(entry => toCard(site, entry)),
  }
}

/** `toSorted` is stable, so the manifest's own order settles a tie. */
function buildArchive(site: Site, tag: string | null): ArchiveModel {
  const listed = site.manifest.articles
  const articles = tag === null ? listed : listed.filter(entry => entry.tags.includes(tag))

  return {
    tag,
    articles: articles.toSorted((a, b) => b.created - a.created).map(entry => toCard(site, entry)),
  }
}

async function readBody(dir: string, file: string): Promise<string> {
  return stripFrontMatter(await fetchText(`${dir}/${encodeURIComponent(file)}`))
}

async function buildArticle(
  site: Site,
  entry: ArticleEntry,
  unlisted: boolean,
  context: RenderContext,
): Promise<ArticleModel> {
  return {
    title: entry.title,
    tags: tagLinks(site, entry.tags),
    created: entry.created,
    updated: entry.updated,
    unlisted,
    html: site.renderers.for(entry.file)(await readBody(articlesDir, entry.file), context),
  }
}

async function buildPage(site: Site, entry: PageEntry, context: RenderContext): Promise<PageModel> {
  return {
    title: entry.title,
    html: site.renderers.for(entry.file)(await readBody(pagesDir, entry.file), context),
  }
}

/** Every view but the list's first page says what it is, then whose site it is. */
function titled(site: Site, head: string): string {
  return `${head} — ${site.manifest.site.title}`
}

function notFound(site: Site, message: string): Missing {
  return { tag: null, message, title: titled(site, site.words.notFound), context: {} }
}

export async function renderRoute(site: Site, route: Route | null): Promise<Rendered> {
  const siteTitle = site.manifest.site.title
  const { words } = site

  if (route === null) return notFound(site, words.noSuchRoute)

  switch (route.type) {
    case 'home': {
      const model = buildList(site, route.page)
      if (model === null) return notFound(site, words.noSuchListPage)

      return {
        tag: themeElements.articleList,
        model,
        title: route.page === 1 ? siteTitle : `${siteTitle} — ${route.page}`,
        comments: false,
        context: {},
      }
    }
    case 'archive':
      return {
        tag: themeElements.archive,
        model: buildArchive(site, null),
        title: titled(site, words.archive),
        comments: false,
        context: {},
      }
    case 'tag': {
      const model = buildArchive(site, route.tag)
      if (model.articles.length === 0) return notFound(site, words.noSuchTag)

      return {
        tag: themeElements.archive,
        model,
        title: titled(site, words.tagged(route.tag)),
        comments: false,
        context: {},
      }
    }
    case 'article': {
      const found = site.bySlug.get(route.slug)
      if (found === undefined) return notFound(site, words.noSuchArticle)

      const context = { baseUrl: `${articlesDir}/`, href: serializeRoute(route, site.router) }
      const model = await buildArticle(site, found.entry, found.unlisted, context)

      return {
        tag: themeElements.article,
        model,
        title: titled(site, model.title),
        comments: found.entry.comments,
        context,
      }
    }
    case 'page': {
      const entry = site.pageBySlug.get(route.slug)
      if (entry === undefined) return notFound(site, words.noSuchPage)

      const context = { baseUrl: `${pagesDir}/`, href: serializeRoute(route, site.router) }
      const model = await buildPage(site, entry, context)

      return {
        tag: themeElements.page,
        model,
        title: titled(site, model.title),
        comments: entry.comments,
        context,
      }
    }
  }
}

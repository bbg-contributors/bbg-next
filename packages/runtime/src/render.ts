import type { Site } from './site.ts'
import type { ArticleEntry, RenderContext, Route } from '@bbg-next/core'
import type {
  ArchiveModel,
  ArticleCard,
  ArticleLink,
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

type Rendered = Found | Missing

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

function articleHref(site: Site, entry: ArticleEntry): string {
  return serializeRoute({ type: 'article', slug: entry.slug }, site.router)
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
    href: articleHref(site, entry),
  }
}

/** Newest first in the timeline, so the one written before sits after it. An unlisted article has no place there and so no neighbours. */
function neighbours(site: Site, entry: ArticleEntry): Pick<ArticleModel, 'previous' | 'next'> {
  const at = site.timeline.indexOf(entry)
  const link = (index: number): ArticleLink | null => {
    const neighbour = at === -1 ? undefined : site.timeline[index]

    return neighbour === undefined ? null : { title: neighbour.title, href: articleHref(site, neighbour) }
  }

  return { previous: link(at + 1), next: link(at - 1) }
}

function buildList(site: Site, page: number): ArticleListModel | null {
  const { articles, site: settings } = site.manifest
  const perPage = settings.articlesPerPage
  const totalPages = Math.max(1, Math.ceil(articles.length / perPage))
  if (page > totalPages) return null

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

function buildArchive(site: Site, tag: string | null): ArchiveModel {
  const { timeline } = site
  const articles = tag === null ? timeline : timeline.filter(entry => entry.tags.includes(tag))

  return { tag, articles: articles.map(entry => toCard(site, entry)) }
}

async function renderDocument(site: Site, dir: string, file: string, route: Route): Promise<[string, RenderContext]> {
  const context = { baseUrl: `${dir}/`, href: serializeRoute(route, site.router) }
  const source = stripFrontMatter(await fetchText(`${dir}/${encodeURIComponent(file)}`))

  return [site.renderers.for(file)(source, context), context]
}

function titled(site: Site, head: string): string {
  return `${head} — ${site.manifest.site.title}`
}

function view(tag: string, model: unknown, title: string): Found {
  return { tag, model, title, comments: false, context: {} }
}

function notFound(site: Site, message: string): Missing {
  return { tag: null, message, title: titled(site, site.words.notFound), context: {} }
}

export async function renderRoute(site: Site, route: Route | null): Promise<Rendered> {
  const { words } = site
  if (route === null) return notFound(site, words.noSuchRoute)

  switch (route.type) {
    case 'home': {
      const model = buildList(site, route.page)
      if (model === null) return notFound(site, words.noSuchListPage)

      const { title } = site.manifest.site

      return view(themeElements.articleList, model, route.page === 1 ? title : `${title} — ${route.page}`)
    }
    case 'archive':
      return view(themeElements.archive, buildArchive(site, null), titled(site, words.archive))
    case 'tag': {
      const model = buildArchive(site, route.tag)
      if (model.articles.length === 0) return notFound(site, words.noSuchTag)

      return view(themeElements.archive, model, titled(site, words.tagged(route.tag)))
    }
    case 'article': {
      const found = site.bySlug.get(route.slug)
      if (found === undefined) return notFound(site, words.noSuchArticle)

      const { entry, unlisted } = found
      const [html, context] = await renderDocument(site, articlesDir, entry.file, route)
      const model: ArticleModel = {
        title: entry.title,
        tags: tagLinks(site, entry.tags),
        created: entry.created,
        updated: entry.updated,
        unlisted,
        html,
        ...neighbours(site, entry),
      }

      return { tag: themeElements.article, model, title: titled(site, entry.title), comments: entry.comments, context }
    }
    case 'page': {
      const entry = site.pageBySlug.get(route.slug)
      if (entry === undefined) return notFound(site, words.noSuchPage)

      const [html, context] = await renderDocument(site, pagesDir, entry.file, route)
      const model: PageModel = { title: entry.title, html }

      return { tag: themeElements.page, model, title: titled(site, entry.title), comments: entry.comments, context }
    }
  }
}

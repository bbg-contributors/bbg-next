import type { Site } from './site.ts'
import type { ArticleEntry, Route } from '@bbg-next/core'
import type { ArticleCard, ArticleListModel, ArticleModel, PageLink, PageModel } from '@bbg-next/view'
import { articlesDir, pagesDir, renderMarkdown, serializeRoute, stripFrontMatter } from '@bbg-next/core'
import { themeElements } from '@bbg-next/view'
import { fetchText } from './site.ts'

export interface Rendered {
  readonly element: HTMLElement
  readonly title: string
}

export function mount(tag: string, model: unknown): HTMLElement {
  const element = document.createElement(tag)
  // Property, not attribute: an attribute would stringify the model.
  Object.assign(element, { model })

  return element
}

function toCard(site: Site, entry: ArticleEntry): ArticleCard {
  return {
    slug: entry.slug,
    title: entry.title,
    excerpt: entry.excerpt,
    tags: entry.tags,
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

async function readBody(dir: string, file: string): Promise<string> {
  return stripFrontMatter(await fetchText(`${dir}/${encodeURIComponent(file)}`))
}

async function buildArticle(site: Site, slug: string): Promise<ArticleModel | null> {
  const found = site.bySlug.get(slug)
  if (found === undefined) return null

  return {
    title: found.entry.title,
    tags: found.entry.tags,
    created: found.entry.created,
    updated: found.entry.updated,
    unlisted: found.unlisted,
    html: renderMarkdown(await readBody(articlesDir, found.entry.file), { baseUrl: `${articlesDir}/` }),
  }
}

async function buildPage(site: Site, slug: string): Promise<PageModel | null> {
  const entry = site.pageBySlug.get(slug)
  if (entry === undefined) return null

  return {
    title: entry.title,
    html: renderMarkdown(await readBody(pagesDir, entry.file), { baseUrl: `${pagesDir}/` }),
  }
}

function notFound(siteTitle: string, message: string): Rendered {
  const element = document.createElement('div')
  element.className = 'bbg-not-found'
  element.textContent = message

  return { element, title: `Not found — ${siteTitle}` }
}

export async function renderRoute(site: Site, route: Route | null): Promise<Rendered> {
  const siteTitle = site.manifest.site.title

  if (route === null) return notFound(siteTitle, 'This page does not exist.')

  switch (route.type) {
    case 'home': {
      const model = buildList(site, route.page)
      if (model === null) return notFound(siteTitle, 'This page of the archive does not exist.')

      return {
        element: mount(themeElements.articleList, model),
        title: route.page === 1 ? siteTitle : `${siteTitle} — ${route.page}`,
      }
    }
    case 'article': {
      const model = await buildArticle(site, route.slug)
      if (model === null) return notFound(siteTitle, 'This article does not exist or has been deleted.')

      return { element: mount(themeElements.article, model), title: `${model.title} — ${siteTitle}` }
    }
    case 'page': {
      const model = await buildPage(site, route.slug)
      if (model === null) return notFound(siteTitle, 'This page does not exist or has been deleted.')

      return { element: mount(themeElements.page, model), title: `${model.title} — ${siteTitle}` }
    }
  }
}

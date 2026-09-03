import type { ArticleEntry, Manifest, PageEntry, RouterConfig } from '@bbg-next/core'
import type { NavLink, ShellModel } from '@bbg-next/view'
import { manifestPath, renderMarkdown, serializeRoute } from '@bbg-next/core'

export interface Site {
  readonly manifest: Manifest
  readonly router: RouterConfig
  readonly shell: ShellModel
  readonly bySlug: ReadonlyMap<string, { entry: ArticleEntry; unlisted: boolean }>
  readonly pageBySlug: ReadonlyMap<string, PageEntry>
}

export function resolve(path: string): string {
  return new URL(path, document.baseURI).href
}

export async function fetchText(path: string): Promise<string> {
  const response = await fetch(resolve(path))
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${path}`)

  return response.text()
}

export async function loadSite(): Promise<Site> {
  // no-cache revalidates rather than trusting a stale copy after a deploy
  const response = await fetch(resolve(manifestPath), { cache: 'no-cache' })
  if (!response.ok) throw new Error(`Cannot load ${manifestPath}: ${response.status}`)
  const manifest = (await response.json()) as Manifest

  // From the document, not the manifest, so the two cannot disagree about where the site is served.
  const router: RouterConfig = {
    mode: manifest.site.router.mode,
    base: new URL(document.baseURI).pathname,
  }

  const bySlug = new Map<string, { entry: ArticleEntry; unlisted: boolean }>()
  for (const entry of manifest.articles) bySlug.set(entry.slug, { entry, unlisted: false })
  for (const entry of manifest.hidden) bySlug.set(entry.slug, { entry, unlisted: true })

  const links: NavLink[] = manifest.pages
    .filter(page => page.showInNav)
    .map(page => ({
      label: page.navLabel,
      href: serializeRoute({ type: 'page', slug: page.slug }, router),
    }))

  return {
    manifest,
    router,
    bySlug,
    pageBySlug: new Map(manifest.pages.map(page => [page.slug, page])),
    shell: {
      title: manifest.site.title,
      description: manifest.site.description,
      footerHtml: manifest.site.footer === '' ? '' : renderMarkdown(manifest.site.footer),
      homeHref: serializeRoute({ type: 'home', page: 1 }, router),
      links,
    },
  }
}

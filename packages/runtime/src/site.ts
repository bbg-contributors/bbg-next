import type { RendererRegistry } from './plugins.ts'
import type { Wording } from './wording.ts'
import type { ArticleEntry, Manifest, PageEntry, Route, RouterConfig } from '@bbg-next/core'
import type { ShellModel } from '@bbg-next/view'
import { manifestPath, serializeRoute } from '@bbg-next/core'
import { wordingFor } from './wording.ts'

export interface Site {
  readonly manifest: Manifest
  readonly router: RouterConfig
  /** For what is on screen: the `current` flags follow the route. */
  readonly shell: (route: Route | null) => ShellModel
  readonly renderers: RendererRegistry
  readonly bySlug: ReadonlyMap<string, { entry: ArticleEntry; unlisted: boolean }>
  readonly pageBySlug: ReadonlyMap<string, PageEntry>
  readonly words: Wording
}

export function resolve(path: string): string {
  return new URL(path, document.baseURI).href
}

export async function fetchText(path: string): Promise<string> {
  const response = await fetch(resolve(path))
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${path}`)

  return response.text()
}

export async function loadManifest(): Promise<Manifest> {
  // no-cache revalidates rather than trusting a stale copy after a deploy
  const response = await fetch(resolve(manifestPath), { cache: 'no-cache' })
  if (!response.ok) throw new Error(`Cannot load ${manifestPath}: ${response.status}`)

  return (await response.json()) as Manifest
}

/** Split from `loadManifest` so plugins set up in between: the footer is rendered here. */
export function createSite(manifest: Manifest, renderers: RendererRegistry): Site {
  // From the document, not the manifest, so the two cannot disagree about where the site is served.
  const router: RouterConfig = {
    mode: manifest.site.router.mode,
    base: new URL(document.baseURI).pathname,
  }

  const bySlug = new Map<string, { entry: ArticleEntry; unlisted: boolean }>()
  for (const entry of manifest.articles) bySlug.set(entry.slug, { entry, unlisted: false })
  for (const entry of manifest.hidden) bySlug.set(entry.slug, { entry, unlisted: true })

  const nav = manifest.pages
    .filter(page => page.showInNav)
    .map(page => ({
      slug: page.slug,
      label: page.navLabel,
      href: serializeRoute({ type: 'page', slug: page.slug }, router),
    }))

  const homeHref = serializeRoute({ type: 'home', page: 1 }, router)
  const archiveHref = serializeRoute({ type: 'archive' }, router)
  const footerHtml = manifest.site.footer === '' ? '' : renderers.markdown(manifest.site.footer, {})

  return {
    manifest,
    router,
    bySlug,
    renderers,
    pageBySlug: new Map(manifest.pages.map(page => [page.slug, page])),
    words: wordingFor(manifest.site.lang),
    shell: route => ({
      title: manifest.site.title,
      description: manifest.site.description,
      footerHtml,
      home: { href: homeHref, current: route?.type === 'home' },
      archive: { href: archiveHref, current: route?.type === 'archive' || route?.type === 'tag' },
      links: nav.map(({ slug, label, href }) => ({
        label,
        href,
        current: route?.type === 'page' && route.slug === slug,
      })),
    }),
  }
}

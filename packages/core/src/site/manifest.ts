import type { Vfs } from '../vfs.ts'
import type { Diagnostic } from './entries.ts'
import type { ArticleEntry, Manifest, SiteSettings } from './schema.ts'
import { articlesDir, pagesDir } from '../paths.ts'
import { loadArticle, loadPage } from './entries.ts'
import { schemaVersion } from './schema.ts'

export interface BuildManifestOptions {
  readonly vfs: Vfs
  readonly site: SiteSettings
  readonly includeDrafts: boolean
}

export interface BuildManifestResult {
  readonly manifest: Manifest
  readonly diagnostics: readonly Diagnostic[]
}

export function serializeManifest(manifest: Manifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`
}

/** Pinned, then newest, then slug for a stable tie-break. */
function compareArticles(a: ArticleEntry, b: ArticleEntry): number {
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
  if (a.created !== b.created) return b.created - a.created

  return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0
}

function rejectDuplicateSlugs<T extends { slug: string; file: string }>(
  entries: readonly T[],
  dir: string,
  diagnostics: Diagnostic[],
): T[] {
  const seen = new Map<string, string>()
  const kept: T[] = []

  for (const entry of entries) {
    const previous = seen.get(entry.slug)
    if (previous === undefined) {
      seen.set(entry.slug, entry.file)
      kept.push(entry)
      continue
    }
    diagnostics.push({
      level: 'error',
      file: `${dir}/${entry.file}`,
      message: `Slug ${JSON.stringify(entry.slug)} is already used by ${previous}`,
    })
  }

  return kept
}

function isMarkdown(name: string): boolean {
  return name.endsWith('.md') && !name.startsWith('.')
}

export async function buildManifest(options: BuildManifestOptions): Promise<BuildManifestResult> {
  const { vfs, site, includeDrafts } = options
  const diagnostics: Diagnostic[] = []

  // sorted so the first file wins a duplicate slug whatever order the filesystem lists in
  async function loadAll<T>(dir: string, load: (file: string) => Promise<T | null>): Promise<T[]> {
    const files = (await vfs.list(dir)).filter(isMarkdown).sort()
    const loaded = await Promise.all(files.map(load))

    return loaded.filter(item => item !== null)
  }

  const loadedArticles = await loadAll(articlesDir, async file => loadArticle(vfs, file, includeDrafts, diagnostics))
  const loadedPages = await loadAll(pagesDir, async file => loadPage(vfs, file, includeDrafts, diagnostics))

  // One namespace across listed and hidden: a listed post must not shadow a hidden one's direct link.
  const deduped = rejectDuplicateSlugs(
    loadedArticles.map(item => item.entry),
    articlesDir,
    diagnostics,
  )
  const hiddenSlugs = new Set(loadedArticles.filter(item => item.hidden).map(item => item.entry.slug))

  return {
    diagnostics,
    manifest: {
      schemaVersion,
      site,
      articles: deduped.filter(entry => !hiddenSlugs.has(entry.slug)).sort(compareArticles),
      hidden: deduped.filter(entry => hiddenSlugs.has(entry.slug)).sort(compareArticles),
      pages: rejectDuplicateSlugs(loadedPages, pagesDir, diagnostics),
    },
  }
}

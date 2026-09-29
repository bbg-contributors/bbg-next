import type { Vfs } from '../vfs.ts'
import type { ArticleEntry, Manifest, PageEntry, PluginIndexEntry, SiteSettings, ThemeIndexEntry } from './schema.ts'
import * as v from 'valibot'
import { deriveExcerpt } from '../content/excerpt.ts'
import { parseFrontMatter } from '../content/frontmatter.ts'
import { ArticleMetaSchema, PageMetaSchema } from '../content/meta.ts'
import { isValidSlug } from '../content/slug.ts'
import { articlesDir, manifestPath, pagesDir } from '../paths.ts'
import { writeFeeds } from './feeds.ts'
import { defaultExtensions } from './plugins.ts'
import { schemaVersion } from './schema.ts'
import { writeShell } from './shell.ts'

export interface Diagnostic {
  readonly level: 'error' | 'warn'
  readonly file: string
  readonly message: string
}

interface WriteSiteOptions {
  readonly site: SiteSettings
  readonly includeDrafts: boolean
  readonly theme: ThemeIndexEntry
  /** In load order. Also settles which suffixes count as content. */
  readonly plugins: readonly PluginIndexEntry[]
}

interface WriteSiteResult {
  /** What was written, so a watcher can tell this write from a hand edit. */
  readonly manifest: string
  readonly diagnostics: readonly Diagnostic[]
}

interface Document<Meta> {
  readonly file: string
  readonly slug: string
  readonly meta: Meta
  readonly body: string
}

/** Pinned, then newest, then slug for a stable tie-break. */
function compareArticles(a: ArticleEntry, b: ArticleEntry): number {
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
  if (a.created !== b.created) return b.created - a.created

  return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0
}

/** Those without one last. Pages arrive in file-name order, which the stable sort keeps for ties. */
function compareNavOrder(a: number | undefined, b: number | undefined): number {
  if (a === b) return 0
  if (a === undefined) return 1
  if (b === undefined) return -1

  return a - b
}

async function buildManifest(vfs: Vfs, options: WriteSiteOptions, diagnostics: Diagnostic[]): Promise<Manifest> {
  const { site, includeDrafts, theme, plugins } = options
  const extensions = [...defaultExtensions, ...plugins.flatMap(plugin => plugin.extensions)]

  async function load<
    Schema extends v.GenericSchema<unknown, { readonly slug?: string | undefined; readonly draft: boolean }>,
  >(dir: string, schema: Schema): Promise<Document<v.InferOutput<Schema>>[]> {
    // sorted so the first file wins a duplicate slug whatever order the filesystem lists in
    const files = (await vfs.list(dir))
      .filter(name => !name.startsWith('.') && extensions.some(extension => name.endsWith(`.${extension}`)))
      .sort()
    const read = await Promise.allSettled(
      files.map(async file => parseFrontMatter(await vfs.readFile(`${dir}/${file}`))),
    )

    const documents: Document<v.InferOutput<Schema>>[] = []
    // One namespace across listed and hidden: a listed article must not shadow a hidden one's direct link.
    const taken = new Map<string, string>()
    for (const [index, file] of files.entries()) {
      const fail = (message: string): void => void diagnostics.push({ level: 'error', file: `${dir}/${file}`, message })

      const document = read[index]!
      if (document.status === 'rejected') {
        fail((document.reason as Error).message)
        continue
      }

      const result = v.safeParse(schema, document.value.data)
      if (!result.success) {
        fail(v.summarize(result.issues))
        continue
      }

      const meta = result.output
      if (meta.draft && !includeDrafts) continue

      // Every extension is a single segment without dots.
      const slug = meta.slug ?? file.slice(0, file.lastIndexOf('.'))
      if (!isValidSlug(slug)) {
        fail(`Slug ${JSON.stringify(slug)} contains characters that are unsafe in a URL segment`)
        continue
      }

      const previous = taken.get(slug)
      if (previous !== undefined) {
        fail(`Slug ${JSON.stringify(slug)} is already used by ${previous}`)
        continue
      }

      taken.set(slug, file)
      documents.push({ file, slug, meta, body: document.value.body })
    }

    return documents
  }

  const articles = (await load(articlesDir, ArticleMetaSchema)).map(({ file, slug, meta, body }) => {
    // Not mtime: the manifest is committed, so it must be a pure function of content.
    if (meta.created === undefined) {
      diagnostics.push({
        level: 'warn',
        file: `${articlesDir}/${file}`,
        message: 'No `created` in front matter; sorting it last (epoch 0)',
      })
    }

    const created = meta.created ?? 0
    const entry: ArticleEntry = {
      file,
      created,
      slug,
      title: meta.title,
      tags: meta.tags,
      updated: meta.updated ?? created,
      pinned: meta.pinned,
      excerpt: meta.excerpt ?? deriveExcerpt(body),
      comments: meta.comments,
    }

    return { entry, hidden: meta.hidden }
  })

  const pages = (await load(pagesDir, PageMetaSchema))
    .toSorted((a, b) => compareNavOrder(a.meta.navOrder, b.meta.navOrder))
    .map(({ file, slug, meta }): PageEntry => ({
      file,
      slug,
      title: meta.title,
      updated: meta.updated ?? 0,
      showInNav: meta.showInNav,
      navLabel: meta.navLabel ?? meta.title,
      comments: meta.comments,
    }))

  return {
    schemaVersion,
    site,
    theme,
    plugins,
    articles: articles
      .filter(item => !item.hidden)
      .map(item => item.entry)
      .sort(compareArticles),
    hidden: articles
      .filter(item => item.hidden)
      .map(item => item.entry)
      .sort(compareArticles),
    pages,
  }
}

/** Every generated file: the manifest rebuilt from front matter, the shell and the feeds. */
export async function writeSite(vfs: Vfs, options: WriteSiteOptions): Promise<WriteSiteResult> {
  const diagnostics: Diagnostic[] = []
  const manifest = await buildManifest(vfs, options, diagnostics)
  const written = `${JSON.stringify(manifest, null, 2)}\n`

  await vfs.writeFile(manifestPath, written)
  await writeShell(vfs, options.site)
  // A feed reader keeps whatever it once fetched, so a draft must never reach one.
  if (!options.includeDrafts) await writeFeeds(vfs, manifest)

  return { manifest: written, diagnostics }
}

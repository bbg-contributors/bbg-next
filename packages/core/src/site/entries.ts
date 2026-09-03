import type { Vfs } from '../vfs.ts'
import type { ArticleEntry, PageEntry } from './schema.ts'
import * as v from 'valibot'
import { deriveExcerpt } from '../content/excerpt.ts'
import { parseFrontMatter } from '../content/frontmatter.ts'
import { ArticleMetaSchema, PageMetaSchema } from '../content/meta.ts'
import { isValidSlug, slugFromFilename } from '../content/slug.ts'
import { articlesDir, pagesDir } from '../paths.ts'

export interface Diagnostic {
  readonly level: 'error' | 'warn'
  readonly file: string
  readonly message: string
}

export interface LoadedArticle {
  readonly entry: ArticleEntry
  readonly hidden: boolean
}

interface DocumentMeta {
  readonly slug?: string | undefined
  readonly draft: boolean
}

interface Loaded<Meta> {
  readonly meta: Meta
  readonly body: string
  readonly slug: string
}

function issuesToMessage(issues: readonly v.BaseIssue<unknown>[]): string {
  return issues
    .map(issue => {
      const path = issue.path?.map(item => String(item.key)).join('.')

      return path === undefined || path === '' ? issue.message : `${path}: ${issue.message}`
    })
    .join('; ')
}

async function loadDocument<Schema extends v.GenericSchema<unknown, DocumentMeta>>(
  vfs: Vfs,
  dir: string,
  file: string,
  schema: Schema,
  includeDrafts: boolean,
  diagnostics: Diagnostic[],
): Promise<Loaded<v.InferOutput<Schema>> | null> {
  const path = `${dir}/${file}`

  const fail = (message: string): null => {
    diagnostics.push({ level: 'error', file: path, message })

    return null
  }

  let document
  try {
    document = parseFrontMatter(await vfs.readFile(path))
  } catch (cause) {
    return fail((cause as Error).message)
  }

  const result = v.safeParse(schema, document.data)
  if (!result.success) return fail(issuesToMessage(result.issues))

  const meta = result.output
  if (meta.draft && !includeDrafts) return null

  const slug = meta.slug ?? slugFromFilename(file)
  if (!isValidSlug(slug)) {
    return fail(`Slug ${JSON.stringify(slug)} contains characters that are unsafe in a URL segment`)
  }

  return { meta, slug, body: document.body }
}

export async function loadArticle(
  vfs: Vfs,
  file: string,
  includeDrafts: boolean,
  diagnostics: Diagnostic[],
): Promise<LoadedArticle | null> {
  const loaded = await loadDocument(vfs, articlesDir, file, ArticleMetaSchema, includeDrafts, diagnostics)
  if (loaded === null) return null

  const { meta } = loaded
  if (meta.created === undefined) {
    // Not mtime: the manifest is committed, so it must be a pure function of content.
    diagnostics.push({
      level: 'warn',
      file: `${articlesDir}/${file}`,
      message: 'No `created` in front matter; sorting it last (epoch 0)',
    })
  }

  const created = meta.created ?? 0

  return {
    hidden: meta.hidden,
    entry: {
      file,
      created,
      slug: loaded.slug,
      title: meta.title,
      tags: meta.tags,
      updated: meta.updated ?? created,
      pinned: meta.pinned,
      excerpt: meta.excerpt ?? deriveExcerpt(loaded.body),
    },
  }
}

export async function loadPage(
  vfs: Vfs,
  file: string,
  includeDrafts: boolean,
  diagnostics: Diagnostic[],
): Promise<PageEntry | null> {
  const loaded = await loadDocument(vfs, pagesDir, file, PageMetaSchema, includeDrafts, diagnostics)
  if (loaded === null) return null

  const { meta } = loaded

  return {
    file,
    slug: loaded.slug,
    title: meta.title,
    updated: meta.updated ?? 0,
    showInNav: meta.showInNav,
    navLabel: meta.navLabel ?? meta.title,
  }
}

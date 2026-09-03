import * as v from 'valibot'

// data/site.json: authored settings, plus the index generated from front matter.

export const SiteSettingsSchema = v.object({
  title: v.pipe(v.string(), v.minLength(1)),
  description: v.optional(v.string(), ''),
  /** BCP-47. Lands verbatim in `<html lang>`. */
  lang: v.optional(v.string(), 'zh-CN'),
  footer: v.optional(v.string(), ''),
  theme: v.optional(v.string(), 'default-theme'),
  postsPerPage: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), 10),
  router: v.optional(
    v.object({
      mode: v.optional(v.picklist(['hash', 'path']), 'hash'),
      base: v.optional(v.string(), '/'),
    }),
    { mode: 'hash', base: '/' },
  ),
})

export type SiteSettings = v.InferOutput<typeof SiteSettingsSchema>

// Plain types, not schemas: we generate this half ourselves from already-validated front matter.

export interface ArticleEntry {
  readonly slug: string
  readonly file: string
  readonly title: string
  readonly tags: readonly string[]
  readonly created: number
  readonly updated: number
  readonly pinned: boolean
  readonly excerpt: string
}

export interface PageEntry {
  readonly slug: string
  readonly file: string
  readonly title: string
  readonly updated: number
  readonly showInNav: boolean
  readonly navLabel: string
}

export const schemaVersion = 1

export interface Manifest {
  readonly schemaVersion: typeof schemaVersion
  readonly site: SiteSettings
  readonly articles: readonly ArticleEntry[]
  /** A separate array, not a flag, so a theme cannot enumerate these by accident. */
  readonly hidden: readonly ArticleEntry[]
  readonly pages: readonly PageEntry[]
}

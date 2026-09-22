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
  /** Load order. Options live in `data/plugins/<name>.json`. */
  plugins: v.optional(v.array(v.pipe(v.string(), v.minLength(1))), []),
})

export type SiteSettings = v.InferOutput<typeof SiteSettingsSchema>

/** `bbg/plugins/<name>/plugin.json`. */
export const PluginMetaSchema = v.pipe(
  v.object({
    name: v.pipe(v.string(), v.minLength(1)),
    version: v.pipe(v.string(), v.minLength(1)),
    /** Suffixes this plugin renders, without the dot. */
    extensions: v.optional(v.array(v.pipe(v.string(), v.regex(/^[a-z0-9]+$/i))), []),
    /** name -> semver range */
    dependencies: v.optional(v.record(v.string(), v.string()), {}),
    /** Option keys the site must set. Sync refuses the plugin without them. */
    requiredOptions: v.optional(v.array(v.string()), []),
    /** False when the plugin reads no options: no config file, no fetch. */
    configurable: v.optional(v.boolean(), true),
  }),
  v.check(
    meta => meta.configurable || meta.requiredOptions.length === 0,
    'A plugin with requiredOptions cannot also say "configurable": false',
  ),
)

export type PluginMeta = v.InferOutput<typeof PluginMetaSchema>

/** `bbg/themes/<name>/theme.json`. A theme only draws, so it declares nothing but itself. */
export const ThemeMetaSchema = v.object({
  name: v.pipe(v.string(), v.minLength(1)),
  version: v.pipe(v.string(), v.minLength(1)),
})

export type ThemeMeta = v.InferOutput<typeof ThemeMetaSchema>

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

export interface PluginIndexEntry {
  readonly name: string
  readonly version: string
  readonly extensions: readonly string[]
  /** Carried through so the runtime can refuse a `require` the plugin never declared. */
  readonly dependencies: Readonly<Record<string, string>>
  /** Sync found `data/plugins/<name>.json`; without one the plugin gets `{}`. */
  readonly hasConfig: boolean
}

export const schemaVersion = 1

export interface Manifest {
  readonly schemaVersion: typeof schemaVersion
  readonly site: SiteSettings
  /** Generated: what is installed under `bbg/plugins`, in load order. */
  readonly plugins: readonly PluginIndexEntry[]
  readonly articles: readonly ArticleEntry[]
  /** A separate array, not a flag, so a theme cannot enumerate these by accident. */
  readonly hidden: readonly ArticleEntry[]
  readonly pages: readonly PageEntry[]
}

import type { Manifest, PluginIndexEntry, ThemeIndexEntry } from '../src/site/schema.ts'
import * as v from 'valibot'
import { describe, expect, it } from 'vitest'
import { writeSite } from '../src/site/manifest.ts'
import { PluginMetaSchema, SiteSettingsSchema, ThemeMetaSchema } from '../src/site/schema.ts'
import { createMemoryVfs } from '../testing/index.ts'

const site = v.parse(SiteSettingsSchema, { title: 'Test blog', articlesPerPage: 2 })
const theme: ThemeIndexEntry = { name: 'default-theme', version: '1.2.3', hasConfig: false }

function article(front: string, body = 'Body text.\n'): string {
  return `---\n${front}\n---\n\n${body}`
}

const at = (iso: string) => `created: ${iso}`

async function build(files: Record<string, string>, plugins: readonly PluginIndexEntry[] = []) {
  const { diagnostics, manifest } = await writeSite(createMemoryVfs(files), {
    site,
    includeDrafts: false,
    theme,
    plugins,
  })

  return { diagnostics, manifest: JSON.parse(manifest) as Manifest }
}

describe('articles', () => {
  it('leave a draft out entirely, and keep a hidden one apart from the listed', async () => {
    const { manifest } = await build({
      'data/articles/normal.md': article(`title: Normal\n${at('2026-01-03T00:00:00Z')}`),
      'data/articles/secret.md': article(`title: Secret\nhidden: true\n${at('2026-01-02T00:00:00Z')}`),
      'data/articles/wip.md': article(`title: WIP\ndraft: true\n${at('2026-01-01T00:00:00Z')}`),
    })

    expect(manifest.articles.map(entry => entry.slug)).toEqual(['normal'])
    expect(manifest.hidden.map(entry => entry.slug)).toEqual(['secret'])
  })

  it('come pinned first, then newest, then by slug, so the committed manifest is stable', async () => {
    const { manifest } = await build({
      'data/articles/z.md': article(`title: Z\n${at('2026-01-01T00:00:00Z')}`),
      'data/articles/a.md': article(`title: A\n${at('2026-01-01T00:00:00Z')}`),
      'data/articles/b.md': article(`title: B\n${at('2026-03-01T00:00:00Z')}`),
      'data/articles/c.md': article(`title: C\npinned: true\n${at('2020-01-01T00:00:00Z')}`),
    })

    expect(manifest.articles.map(entry => entry.slug)).toEqual(['c', 'b', 'a', 'z'])
  })

  it('without `created` are warned about and dated epoch 0', async () => {
    const { diagnostics, manifest } = await build({ 'data/articles/a.md': article('title: A') })

    expect(manifest.articles[0]?.created).toBe(0)
    expect(diagnostics[0]?.level).toBe('warn')
  })

  it('dated past the four-digit years a feed can write are refused', async () => {
    const { diagnostics, manifest } = await build({ 'data/articles/a.md': article('title: A\ncreated: 1e16') })

    expect(manifest.articles).toHaveLength(0)
    expect(diagnostics[0]?.level).toBe('error')
  })

  it('that cannot be read are reported with the reason', async () => {
    const { diagnostics, manifest } = await build({ 'data/articles/a.md': article('tags: [x]') })

    expect(manifest.articles).toHaveLength(0)
    expect(diagnostics[0]?.message).toContain('title')
  })

  it('in a suffix count only once a plugin claims it', async () => {
    const typst: PluginIndexEntry = {
      name: 'typst',
      version: '1.0.0',
      extensions: ['typ'],
      dependencies: {},
      hasConfig: false,
    }
    const files = {
      'data/articles/a.md': article(`title: A\n${at('2026-01-02T00:00:00Z')}`),
      'data/articles/b.typ': article(`title: B\n${at('2026-01-01T00:00:00Z')}`),
    }

    expect((await build(files)).manifest.articles.map(entry => entry.slug)).toEqual(['a'])
    expect((await build(files, [typst])).manifest.articles.map(entry => entry.slug)).toEqual(['a', 'b'])
  })
})

describe('slugs', () => {
  it('come from the file name, CJK and all, unless front matter sets one, so a renamed file keeps its URL', async () => {
    const { manifest } = await build({
      'data/articles/第一篇文章.md': article(`title: 第一篇文章\n${at('2026-01-02T00:00:00Z')}`),
      'data/articles/renamed.md': article(`title: T\nslug: original\n${at('2026-01-01T00:00:00Z')}`),
    })

    expect(manifest.articles.map(entry => [entry.file, entry.slug])).toEqual([
      ['第一篇文章.md', '第一篇文章'],
      ['renamed.md', 'original'],
    ])
  })

  it('go to the first file to claim one, which keeps its own flag, and the others are reported', async () => {
    const { diagnostics, manifest } = await build({
      'data/articles/a.md': article(`title: Listed\nslug: same\n${at('2026-01-01T00:00:00Z')}`),
      'data/articles/b.md': article(`title: Hidden\nslug: same\nhidden: true\n${at('2026-01-01T00:00:00Z')}`),
    })

    expect(manifest.articles.map(entry => entry.title)).toEqual(['Listed'])
    expect(manifest.hidden).toEqual([])
    expect(diagnostics.map(diagnostic => diagnostic.level)).toEqual(['error'])
  })

  it('refuse what is unsafe in a URL segment', async () => {
    const { diagnostics, manifest } = await build({
      'data/articles/bad.md': article(`title: Bad\nslug: a/b\n${at('2026-01-01T00:00:00Z')}`),
    })

    expect(manifest.articles).toHaveLength(0)
    expect(diagnostics[0]?.level).toBe('error')
  })
})

describe('pages', () => {
  it('come in nav order, those without one after the rest by file name', async () => {
    const { manifest } = await build({
      'data/pages/a.md': article('title: A'),
      'data/pages/b.md': article('title: B\nnavOrder: 2'),
      'data/pages/c.md': article('title: C'),
      'data/pages/d.md': article('title: D\nnavOrder: 1'),
    })

    expect(manifest.pages.map(entry => entry.slug)).toEqual(['d', 'b', 'a', 'c'])
  })
})

describe('settings', () => {
  const parse = (settings: Readonly<Record<string, unknown>>) =>
    v.safeParse(SiteSettingsSchema, { title: 'T', ...settings })

  it('take a seed only as #rrggbb, the one form every theme can read', () => {
    for (const seed of ['0d6efd', '#0d6', '#0d6efd80', 'blue']) expect(parse({ seed }).success).toBe(false)
  })

  it('take url as a scheme and host alone, without a trailing slash, since its path is router.base', () => {
    expect(v.parse(SiteSettingsSchema, { title: 'T', url: 'https://example.com/' }).url).toBe('https://example.com')
    for (const url of ['https://example.com/blog', 'example.com']) expect(parse({ url }).success).toBe(false)
  })

  it('need url once the feed or the sitemap is on, and not before', () => {
    expect(parse({}).success).toBe(true)
    expect(parse({ atom: true }).success).toBe(false)
    expect(parse({ sitemap: true }).success).toBe(false)
    expect(parse({ atom: true, sitemap: true, url: 'https://example.com' }).success).toBe(true)
  })
})

describe('assets a plugin or theme brings', () => {
  const parse = (assets: unknown) => [
    v.safeParse(PluginMetaSchema, { name: 'p', version: '1.0.0', assets }),
    v.safeParse(ThemeMetaSchema, { name: 't', version: '1.0.0', assets }),
  ]

  it('stay inside its own directory, apart from its script and its metadata', () => {
    for (const result of parse(['assets/', 'fonts/serif.woff2'])) {
      expect(result.success && result.output.assets).toEqual(['assets', 'fonts/serif.woff2'])
    }
    for (const path of [
      '/etc/passwd',
      '../x',
      'a/../../x',
      'a\\b',
      'C:/x',
      '',
      'index.js',
      'plugin.json',
      'theme.json',
    ]) {
      for (const result of parse([path])) expect(result.success).toBe(false)
    }
  })
})

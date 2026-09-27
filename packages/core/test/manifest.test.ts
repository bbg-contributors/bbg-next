import type { PluginIndexEntry, ThemeIndexEntry } from '../src/site/schema.ts'
import * as v from 'valibot'
import { describe, expect, it } from 'vitest'
import { buildManifest } from '../src/site/manifest.ts'
import { SiteSettingsSchema } from '../src/site/schema.ts'
import { createMemoryVfs } from './memoryVfs.ts'

const site = v.parse(SiteSettingsSchema, { title: 'Test blog', postsPerPage: 2 })
const theme: ThemeIndexEntry = { name: 'default-theme', version: '1.2.3', hasConfig: false }

function article(front: string, body = 'Body text.\n'): string {
  return `---\n${front}\n---\n\n${body}`
}

const at = (iso: string) => `created: ${iso}`

async function build(files: Record<string, string>, includeDrafts = false, plugins: readonly PluginIndexEntry[] = []) {
  return buildManifest({ vfs: createMemoryVfs(files), site, includeDrafts, theme, plugins })
}

describe('draft vs hidden', () => {
  const files = {
    'data/articles/normal.md': article(`title: Normal\n${at('2026-01-03T00:00:00Z')}`),
    'data/articles/secret.md': article(`title: Secret\nhidden: true\n${at('2026-01-02T00:00:00Z')}`),
    'data/articles/wip.md': article(`title: WIP\ndraft: true\n${at('2026-01-01T00:00:00Z')}`),
  }

  it('keeps drafts out of the manifest entirely', async () => {
    const { manifest } = await build(files)
    const slugs = [...manifest.articles, ...manifest.hidden].map(entry => entry.slug)
    expect(slugs).not.toContain('wip')
  })

  it('puts hidden articles in `hidden`, never in `articles`', async () => {
    const { manifest } = await build(files)
    expect(manifest.articles.map(entry => entry.slug)).toEqual(['normal'])
    expect(manifest.hidden.map(entry => entry.slug)).toEqual(['secret'])
  })

  it('includes drafts when asked', async () => {
    const { manifest } = await build(files, true)
    expect(manifest.articles.map(entry => entry.slug).sort()).toEqual(['normal', 'wip'])
  })
})

describe('ordering', () => {
  it('sorts pinned first, then newest first', async () => {
    const { manifest } = await build({
      'data/articles/a.md': article(`title: A\n${at('2026-01-01T00:00:00Z')}`),
      'data/articles/b.md': article(`title: B\n${at('2026-03-01T00:00:00Z')}`),
      'data/articles/c.md': article(`title: C\npinned: true\n${at('2020-01-01T00:00:00Z')}`),
    })
    expect(manifest.articles.map(entry => entry.slug)).toEqual(['c', 'b', 'a'])
  })

  it('breaks ties by slug so the committed manifest is stable', async () => {
    const { manifest } = await build({
      'data/articles/z.md': article(`title: Z\n${at('2026-01-01T00:00:00Z')}`),
      'data/articles/a.md': article(`title: A\n${at('2026-01-01T00:00:00Z')}`),
    })
    expect(manifest.articles.map(entry => entry.slug)).toEqual(['a', 'z'])
  })
})

describe('slugs', () => {
  it('defaults to the filename and preserves CJK', async () => {
    const { manifest } = await build({
      'data/articles/第一篇文章.md': article(`title: 第一篇文章\n${at('2026-01-01T00:00:00Z')}`),
    })
    expect(manifest.articles[0]?.slug).toBe('第一篇文章')
  })

  it('lets front matter override it, so renaming a file keeps the URL', async () => {
    const { manifest } = await build({
      'data/articles/renamed.md': article(`title: T\nslug: original\n${at('2026-01-01T00:00:00Z')}`),
    })
    expect(manifest.articles[0]?.slug).toBe('original')
    expect(manifest.articles[0]?.file).toBe('renamed.md')
  })

  it('reports a duplicate slug and keeps only the first', async () => {
    const { diagnostics, manifest } = await build({
      'data/articles/one.md': article(`title: One\nslug: same\n${at('2026-01-01T00:00:00Z')}`),
      'data/articles/two.md': article(`title: Two\nslug: same\n${at('2026-01-01T00:00:00Z')}`),
    })
    expect(manifest.articles).toHaveLength(1)
    expect(diagnostics.filter(d => d.level === 'error')).toHaveLength(1)
  })

  it('strips only the suffix, however many dots the name has', async () => {
    const { manifest } = await build({
      'data/articles/release.v1.md': article(`title: R\n${at('2026-01-01T00:00:00Z')}`),
    })
    expect(manifest.articles[0]?.slug).toBe('release.v1')
  })

  it('files the article that keeps a contested slug by its own flag, not the loser’s', async () => {
    const { manifest } = await build({
      'data/articles/a.md': article(`title: Listed\nslug: same\n${at('2026-01-01T00:00:00Z')}`),
      'data/articles/b.md': article(`title: Hidden\nslug: same\nhidden: true\n${at('2026-01-01T00:00:00Z')}`),
    })
    expect(manifest.articles.map(entry => entry.title)).toEqual(['Listed'])
    expect(manifest.hidden).toEqual([])
  })

  it('rejects a slug that is unsafe in a URL segment', async () => {
    const { diagnostics, manifest } = await build({
      'data/articles/bad.md': article(`title: Bad\nslug: a/b\n${at('2026-01-01T00:00:00Z')}`),
    })
    expect(manifest.articles).toHaveLength(0)
    expect(diagnostics[0]?.level).toBe('error')
  })
})

describe('metadata', () => {
  it('derives an excerpt from the first paragraph when none is given', async () => {
    const { manifest } = await build({
      'data/articles/a.md': article(
        `title: A\n${at('2026-01-01T00:00:00Z')}`,
        '# Heading\n\nFirst paragraph.\n\nSecond paragraph.\n',
      ),
    })
    expect(manifest.articles[0]?.excerpt).toBe('First paragraph.')
  })

  it('falls back `updated` to `created`', async () => {
    const { manifest } = await build({
      'data/articles/a.md': article(`title: A\n${at('2026-01-01T00:00:00Z')}`),
    })
    expect(manifest.articles[0]?.updated).toBe(manifest.articles[0]?.created)
  })

  it('warns and uses epoch 0 when `created` is missing', async () => {
    const { diagnostics, manifest } = await build({ 'data/articles/a.md': article('title: A') })
    expect(manifest.articles[0]?.created).toBe(0)
    expect(diagnostics[0]?.level).toBe('warn')
  })

  it('de-duplicates tags', async () => {
    const { manifest } = await build({
      'data/articles/a.md': article(`title: A\ntags: [x, x, y]\n${at('2026-01-01T00:00:00Z')}`),
    })
    expect(manifest.articles[0]?.tags).toEqual(['x', 'y'])
  })

  it('leaves comments on unless front matter turns them off', async () => {
    const { manifest } = await build({
      'data/articles/open.md': article(`title: Open\n${at('2026-01-02T00:00:00Z')}`),
      'data/articles/closed.md': article(`title: Closed\ncomments: false\n${at('2026-01-01T00:00:00Z')}`),
    })
    expect(manifest.articles.map(entry => [entry.slug, entry.comments])).toEqual([
      ['open', true],
      ['closed', false],
    ])
  })
})

describe('failures are reported, not swallowed', () => {
  it('skips an article with no title and says why', async () => {
    const { diagnostics, manifest } = await build({
      'data/articles/a.md': article('tags: [x]'),
    })
    expect(manifest.articles).toHaveLength(0)
    expect(diagnostics[0]?.message).toContain('title')
  })

  it('skips an article with an unparseable date', async () => {
    const { diagnostics, manifest } = await build({
      'data/articles/a.md': article('title: A\ncreated: not-a-date'),
    })
    expect(manifest.articles).toHaveLength(0)
    expect(diagnostics[0]?.level).toBe('error')
  })

  it('skips an article dated past the four-digit years a feed can write', async () => {
    const { diagnostics, manifest } = await build({
      'data/articles/a.md': article('title: A\ncreated: 1e16'),
    })
    expect(manifest.articles).toHaveLength(0)
    expect(diagnostics[0]?.level).toBe('error')
  })

  it('ignores non-markdown and dotfiles', async () => {
    const { manifest } = await build({
      'data/articles/.DS_Store': 'junk',
      'data/articles/notes.txt': 'junk',
      'data/articles/a.md': article(`title: A\n${at('2026-01-01T00:00:00Z')}`),
    })
    expect(manifest.articles).toHaveLength(1)
  })

  it('treats a site with no content directories as empty', async () => {
    const { diagnostics, manifest } = await build({})
    expect(manifest.articles).toEqual([])
    expect(manifest.pages).toEqual([])
    expect(diagnostics).toEqual([])
  })
})

describe('content extensions', () => {
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

  it('ignores a suffix no installed renderer claims', async () => {
    const { manifest } = await build(files)
    expect(manifest.articles.map(entry => entry.slug)).toEqual(['a'])
  })

  it('picks up a suffix a plugin claims, and strips it from the slug', async () => {
    const { manifest } = await build(files, false, [typst])
    expect(manifest.articles.map(entry => entry.slug)).toEqual(['a', 'b'])
  })

  // one namespace across renderers: a.md and a.typ would both want /a
  it('reports a slug collision between two renderers', async () => {
    const { diagnostics, manifest } = await build(
      {
        'data/articles/a.md': article(`title: A\n${at('2026-01-02T00:00:00Z')}`),
        'data/articles/a.typ': article(`title: Also A\n${at('2026-01-01T00:00:00Z')}`),
      },
      false,
      [typst],
    )
    expect(manifest.articles).toHaveLength(1)
    expect(diagnostics[0]?.message).toContain('already used')
  })
})

describe('pages', () => {
  it('defaults the nav label to the title and shows in nav', async () => {
    const { manifest } = await build({ 'data/pages/about.md': article('title: About') })
    expect(manifest.pages[0]).toMatchObject({ slug: 'about', navLabel: 'About', showInNav: true })
  })

  it('honours an explicit nav label and hiding', async () => {
    const { manifest } = await build({
      'data/pages/about.md': article('title: About me\nnavLabel: About\nshowInNav: false'),
    })
    expect(manifest.pages[0]).toMatchObject({ navLabel: 'About', showInNav: false })
  })
})

describe('seed', () => {
  const parse = (seed: unknown) => v.safeParse(SiteSettingsSchema, { title: 'T', seed })

  it('takes a six-digit hex colour', () => {
    expect(parse('#0d6efd').success).toBe(true)
  })

  it('refuses anything else, rather than handing a theme a colour it cannot read', () => {
    for (const seed of ['0d6efd', '#0d6', '#0d6efd80', 'blue']) expect(parse(seed).success).toBe(false)
  })
})

describe('url', () => {
  const parse = (settings: Readonly<Record<string, unknown>>) =>
    v.safeParse(SiteSettingsSchema, { title: 'T', ...settings })

  it('takes a scheme and host, without a trailing slash', () => {
    expect(v.parse(SiteSettingsSchema, { title: 'T', url: 'https://example.com/' }).url).toBe('https://example.com')
  })

  it('refuses a path, which router.base holds', () => {
    for (const url of ['https://example.com/blog', 'example.com']) expect(parse({ url }).success).toBe(false)
  })

  it('is needed once the feed or the sitemap is on, and not before', () => {
    expect(parse({}).success).toBe(true)
    expect(parse({ atom: true }).success).toBe(false)
    expect(parse({ sitemap: true }).success).toBe(false)
    expect(parse({ atom: true, sitemap: true, url: 'https://example.com' }).success).toBe(true)
  })
})

import * as v from 'valibot'
import { describe, expect, it } from 'vitest'
import { buildManifest } from '../src/site/manifest.ts'
import { SiteSettingsSchema } from '../src/site/schema.ts'
import { createMemoryVfs } from './memoryVfs.ts'

const site = v.parse(SiteSettingsSchema, { title: 'Test blog', postsPerPage: 2 })

function article(front: string, body = 'Body text.\n'): string {
  return `---\n${front}\n---\n\n${body}`
}

const at = (iso: string) => `created: ${iso}`

async function build(files: Record<string, string>, includeDrafts = false) {
  return buildManifest({ vfs: createMemoryVfs(files), site, includeDrafts })
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

  it('still resolves a hidden article by slug', async () => {
    const { manifest } = await build(files)
    expect(manifest.hidden.find(entry => entry.slug === 'secret')?.title).toBe('Secret')
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

  it('prefers an explicit excerpt', async () => {
    const { manifest } = await build({
      'data/articles/a.md': article(`title: A\nexcerpt: Written by hand\n${at('2026-01-01T00:00:00Z')}`),
    })
    expect(manifest.articles[0]?.excerpt).toBe('Written by hand')
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

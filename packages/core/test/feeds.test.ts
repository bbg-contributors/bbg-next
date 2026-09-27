import type { PluginIndexEntry, ThemeIndexEntry } from '../src/site/schema.ts'
import * as v from 'valibot'
import { describe, expect, it } from 'vitest'
import { writeFeeds } from '../src/site/feeds.ts'
import { buildManifest } from '../src/site/manifest.ts'
import { SiteSettingsSchema } from '../src/site/schema.ts'
import { createMemoryVfs } from './memoryVfs.ts'

const theme: ThemeIndexEntry = { name: 'default-theme', version: '1.2.3', hasConfig: false }

function article(front: string, body = 'Body text.\n'): string {
  return `---\n${front}\n---\n\n${body}`
}

const blog = {
  'data/articles/old.md': article('title: Old\ncreated: 2026-01-01T00:00:00Z'),
  'data/articles/new.md': article(
    'title: New & <improved>\ncreated: 2026-02-01T00:00:00Z\nupdated: 2026-03-01T00:00:00Z',
    '![Sunset](sunset.svg)\n\n[Down](#end)\n',
  ),
  'data/articles/pinned.md': article('title: Pinned\npinned: true\ncreated: 2025-12-01T00:00:00Z'),
  'data/articles/hidden.md': article('title: Hidden\nhidden: true\ncreated: 2026-04-01T00:00:00Z'),
  'data/articles/secret.md': article(
    'title: Secret\ncreated: 2025-11-01T00:00:00Z',
    '```bbg-encrypted\nv1.600000.00.00.00\n```\n',
  ),
  'data/pages/about.md': article('title: About\nshowInNav: false'),
}

async function sync(
  files: Readonly<Record<string, string>>,
  settings: Readonly<Record<string, unknown>> = {},
  plugins: readonly PluginIndexEntry[] = [],
) {
  const vfs = createMemoryVfs(files)
  const site = v.parse(SiteSettingsSchema, {
    title: 'Test blog',
    url: 'https://example.com',
    atom: true,
    sitemap: true,
    ...settings,
  })
  const { manifest } = await buildManifest({ vfs, site, includeDrafts: false, theme, plugins })
  await writeFeeds(vfs, manifest)

  return vfs
}

function entryOf(atom: string, title: string): string {
  return atom.split('<entry>').find(entry => entry.includes(`<title>${title}</title>`)) ?? ''
}

describe('sitemap.txt', () => {
  it('lists the listed articles newest first, then every page, then the archive', async () => {
    const vfs = await sync(blog, { router: { mode: 'path', base: '/blog/' } })

    expect(await vfs.readFile('sitemap.txt')).toBe(
      [
        'https://example.com/blog/post/new/',
        'https://example.com/blog/post/old/',
        'https://example.com/blog/post/pinned/',
        'https://example.com/blog/post/secret/',
        'https://example.com/blog/page/about/',
        'https://example.com/blog/archive/',
        '',
      ].join('\n'),
    )
  })

  it('keeps a hash-routed site on its home page, away from 404.html', async () => {
    const vfs = await sync(blog, { router: { mode: 'hash', base: '/blog/' } })

    expect(await vfs.readFile('sitemap.txt')).toBe(
      [
        'https://example.com/blog/#/post/new',
        'https://example.com/blog/#/post/old',
        'https://example.com/blog/#/post/pinned',
        'https://example.com/blog/#/post/secret',
        'https://example.com/blog/#/page/about',
        'https://example.com/blog/#/archive',
        '',
      ].join('\n'),
    )
  })
})

describe('atom.xml', () => {
  it('is dated by the newest listed article, and leaves hidden ones out', async () => {
    const atom = await (await sync(blog)).readFile('atom.xml')

    expect(
      atom.startsWith(
        '<?xml version="1.0" encoding="utf-8"?>\n<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="zh-CN">\n',
      ),
    ).toBe(true)
    expect(atom).toContain('<link rel="self" href="https://example.com/atom.xml"/>')
    expect(atom).toContain('<id>https://example.com/</id>\n<updated>2026-03-01T00:00:00.000Z</updated>')
    expect(atom).not.toContain('Hidden')
  })

  it('carries an article whole, with addresses a reader can follow', async () => {
    const entry = entryOf(await (await sync(blog)).readFile('atom.xml'), 'New &amp; &lt;improved&gt;')

    expect(entry).toContain('<link href="https://example.com/#/post/new"/>\n<id>https://example.com/#/post/new</id>')
    expect(entry).toContain('src=&quot;https://example.com/data/articles/sunset.svg&quot;')
    expect(entry).toContain('href=&quot;https://example.com/#/post/new#end&quot;')
  })

  it('gives an encrypted article only its title and link', async () => {
    const entry = entryOf(await (await sync(blog)).readFile('atom.xml'), 'Secret')

    expect(entry).toContain('<link href="https://example.com/#/post/secret"/>')
    expect(entry).not.toContain('<content')
    expect(entry).not.toContain('<summary')
  })

  it('gives a format only a plugin renders just its summary', async () => {
    const typst: PluginIndexEntry = {
      name: 'typst',
      version: '1.0.0',
      extensions: ['typ'],
      dependencies: {},
      hasConfig: false,
    }
    const notes = article('title: Notes\ncreated: 2026-05-01T00:00:00Z', 'Typed notes.\n')
    const entry = entryOf(
      await (await sync({ 'data/articles/notes.typ': notes }, {}, [typst])).readFile('atom.xml'),
      'Notes',
    )

    expect(entry).toContain('<summary>Typed notes.</summary>')
    expect(entry).not.toContain('<content')
  })

  it('drops characters XML cannot carry', async () => {
    const bell = article('title: Bell\ncreated: 2026-05-01T00:00:00Z', 'Ding\u{7}dong.\n')
    const atom = await (await sync({ 'data/articles/bell.md': bell })).readFile('atom.xml')

    expect(atom).not.toContain('\u{7}')
    expect(atom).toContain('<summary>Dingdong.</summary>')
  })

  it('is still dated with nothing in it', async () => {
    const atom = await (await sync({})).readFile('atom.xml')

    expect(atom).toContain('<updated>1970-01-01T00:00:00.000Z</updated>')
  })
})

describe('switched off', () => {
  it('leaves whatever is there alone, such as the files an old editor wrote', async () => {
    const vfs = await sync({ ...blog, 'atom.xml': 'from the old editor' }, { atom: false, sitemap: false })

    expect(await vfs.readFile('atom.xml')).toBe('from the old editor')
    expect(await vfs.exists('sitemap.txt')).toBe(false)
  })
})

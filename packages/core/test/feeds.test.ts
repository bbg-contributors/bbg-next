import type { PluginIndexEntry, ThemeIndexEntry } from '../src/site/schema.ts'
import * as v from 'valibot'
import { describe, expect, it } from 'vitest'
import { writeSite } from '../src/site/manifest.ts'
import { SiteSettingsSchema } from '../src/site/schema.ts'
import { createMemoryVfs } from '../testing/index.ts'

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
  includeDrafts = false,
) {
  const vfs = createMemoryVfs(files)
  const site = v.parse(SiteSettingsSchema, {
    title: 'Test blog',
    url: 'https://example.com',
    atom: true,
    sitemap: true,
    ...settings,
  })
  await writeSite(vfs, { site, includeDrafts, theme, plugins })

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
        'https://example.com/blog/article/new/',
        'https://example.com/blog/article/old/',
        'https://example.com/blog/article/pinned/',
        'https://example.com/blog/article/secret/',
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
        'https://example.com/blog/#/article/new',
        'https://example.com/blog/#/article/old',
        'https://example.com/blog/#/article/pinned',
        'https://example.com/blog/#/article/secret',
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

    expect(entry).toContain(
      '<link href="https://example.com/#/article/new"/>\n<id>https://example.com/#/article/new</id>',
    )
    expect(entry).toContain('src=&quot;https://example.com/data/articles/sunset.svg&quot;')
    expect(entry).toContain('href=&quot;https://example.com/#/article/new#end&quot;')
  })

  it('links a hash-routed site’s other views in full, while `#/…` stays a fragment where the site routes by path', async () => {
    const files = {
      ...blog,
      'data/articles/old.md': article('title: Old\ncreated: 2026-01-01', '[New](#/article/new)\n'),
    }
    const pathRouted = { router: { mode: 'path', base: '/blog/' } }

    expect(entryOf(await (await sync(files)).readFile('atom.xml'), 'Old')).toContain(
      'href=&quot;https://example.com/#/article/new&quot;',
    )
    expect(entryOf(await (await sync(files, pathRouted)).readFile('atom.xml'), 'Old')).toContain(
      'href=&quot;https://example.com/blog/article/old/#/article/new&quot;',
    )
  })

  it('carries no content only the browser can show: an encrypted block, or a format a plugin renders', async () => {
    const typst: PluginIndexEntry = {
      name: 'typst',
      version: '1.0.0',
      extensions: ['typ'],
      dependencies: {},
      hasConfig: false,
    }
    const notes = article('title: Notes\ncreated: 2026-05-01T00:00:00Z', 'Typed notes.\n')
    const atom = await (await sync({ ...blog, 'data/articles/notes.typ': notes }, {}, [typst])).readFile('atom.xml')

    expect(entryOf(atom, 'Secret')).toContain('<link href="https://example.com/#/article/secret"/>')
    expect(entryOf(atom, 'Secret')).not.toMatch(/<content|<summary/)
    expect(entryOf(atom, 'Notes')).toContain('<summary>Typed notes.</summary>')
    expect(entryOf(atom, 'Notes')).not.toContain('<content')
  })

  it('drops characters XML cannot carry', async () => {
    const bell = article('title: Bell\ncreated: 2026-05-01T00:00:00Z', 'Ding\u{7}dong.\n')
    const atom = await (await sync({ 'data/articles/bell.md': bell })).readFile('atom.xml')

    expect(atom).not.toContain('\u{7}')
    expect(atom).toContain('<summary>Dingdong.</summary>')
  })
})

describe('switched off', () => {
  it('leaves whatever is there alone, such as the files an old editor wrote', async () => {
    const vfs = await sync({ ...blog, 'atom.xml': 'from the old editor' }, { atom: false, sitemap: false })

    expect(await vfs.readFile('atom.xml')).toBe('from the old editor')
    expect(await vfs.exists('sitemap.txt')).toBe(false)
  })

  it('while drafts are shown, so none reaches a feed reader', async () => {
    const vfs = await sync(blog, {}, [], true)

    expect(await vfs.exists('atom.xml')).toBe(false)
    expect(await vfs.exists('sitemap.txt')).toBe(false)
  })
})

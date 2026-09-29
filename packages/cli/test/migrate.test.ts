import type { AskPassword } from '../src/terminal/tty.ts'
import type { Diagnostic, Manifest, SiteSettings, Vfs } from '@bbg-next/core'
import { decryptDocument, writeSite } from '@bbg-next/core'
import { createMemoryVfs } from '@bbg-next/core/testing'
import { describe, expect, it } from 'vitest'
import { migrateSite } from '../src/migrate/index.ts'

// As the old editor's sjcl wrote them: `# 秘密\n\n只给知道密码的人看，[附件](notes.pdf)。\n` behind `hunter2`, and `藏起来的一段` behind `swordfish`.
const lockedArticle =
  '{"iv":"gWerg3VrktqWhJakzyQzGw==","v":1,"iter":10000,"ks":128,"ts":64,"mode":"ccm","adata":"","cipher":"aes","salt":"78ivnbjNARU=","ct":"0uBjNqlJxrQF0/kYO8TPHvURAKfu14ooKC/oOLxZcYLSu2G54DcbFx+/zALiT1201TGMvPJG4eA7f6Wq1WHtPxQJdv2bd4c="}'
const lockedBlock =
  '{"iv":"iMsUsxIsdylGMxuuDO+x3A==","v":1,"iter":10000,"ks":128,"ts":64,"mode":"ccm","adata":"","cipher":"aes","salt":"Bu8rDf+Ef0A=","ct":"SoPAmMHlbaZMa8rwyTHGKTc0HuoXV1KVOAM="}'

function oldSite(index: Readonly<Record<string, unknown>>, files: Readonly<Record<string, string>> = {}): Vfs {
  return createMemoryVfs({ 'data/index.json': JSON.stringify(index), ...files })
}

function article(file: string, extra: Readonly<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    文章标题: file,
    文件名: file,
    标签: [],
    摘要: '',
    是否置顶: false,
    是否隐藏: false,
    启用评论: true,
    ...extra,
  }
}

function page(file: string, extra: Readonly<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    页面标题: file,
    是否显示在菜单中: true,
    '若显示在菜单中，则在菜单中显示为': '',
    文件名: file,
    启用评论: false,
    ...extra,
  }
}

/** Gives each question the next answer, then runs out as a pipe would. */
function answering(...answers: string[]): { readonly ask: AskPassword; readonly asked: string[] } {
  const asked: string[] = []

  return {
    asked,
    ask: async question => {
      asked.push(question)

      return answers.shift() ?? null
    },
  }
}

async function migrate(
  vfs: Vfs,
  ask: AskPassword = answering().ask,
): Promise<{ site: SiteSettings; messages: string[]; diagnostics: readonly Diagnostic[] }> {
  const { site, diagnostics } = await migrateSite(vfs, ask)

  return { site, diagnostics, messages: diagnostics.map(diagnostic => `${diagnostic.file}: ${diagnostic.message}`) }
}

/** What bbg-next makes of the migrated site, which it must be able to read in full. */
async function manifestOf(vfs: Vfs, site: SiteSettings): Promise<Manifest> {
  const theme = { name: 'default-theme', version: '1.0.0', hasConfig: false }
  const { diagnostics, manifest } = await writeSite(vfs, { site, includeDrafts: false, theme, plugins: [] })
  expect(diagnostics.filter(diagnostic => diagnostic.level === 'error')).toEqual([])

  return JSON.parse(manifest) as Manifest
}

describe('articles', () => {
  it('keep their file names, with what the list said of them as front matter', async () => {
    const vfs = oldSite(
      {
        文章列表: [
          article('hKx3pTa7.md', {
            文章标题: '第一篇',
            标签: ['随笔', ''],
            摘要: '摘要一',
            '创建时间（时间戳）': Date.parse('2024-06-01T10:00:00Z'),
            '修改时间（时间戳）': Date.parse('2024-06-02T10:00:00Z'),
            是否置顶: true,
            启用评论: false,
          }),
          article('my article.md', { 文章标题: 'My article', '创建时间（时间戳）': 0, 是否隐藏: true }),
        ],
      },
      { 'data/articles/hKx3pTa7.md': 'Body one.\n', 'data/articles/my article.md': '\uFEFFBody two.\n' },
    )

    const { site } = await migrate(vfs)

    expect(await vfs.readFile('data/articles/hKx3pTa7.md')).toBe(
      '---\ntitle: 第一篇\ntags:\n  - 随笔\ncreated: 2024-06-01T10:00:00.000Z\nupdated: 2024-06-02T10:00:00.000Z\npinned: true\nexcerpt: 摘要一\ncomments: false\n---\n\nBody one.\n',
    )
    const { articles, hidden } = await manifestOf(vfs, site)
    expect(articles.map(entry => [entry.file, entry.slug])).toEqual([['hKx3pTa7.md', 'hKx3pTa7']])
    expect(hidden.map(entry => [entry.file, entry.slug, entry.created])).toEqual([['my article.md', 'my-article', 0]])
  })

  it('dated before 20240518 get the eight hours the old editor gave them', async () => {
    const vfs = oldSite({ 文章列表: [article('a.md', { 创建日期: '2022-01-05' })] }, { 'data/articles/a.md': 'A\n' })

    const { site } = await migrate(vfs)

    expect((await manifestOf(vfs, site)).articles[0]?.created).toBe(Date.parse('2022-01-05T08:00:00Z'))
  })

  it('an entry that cannot be used is dropped, and a file in no list kept as a draft', async () => {
    const vfs = oldSite(
      {
        文章列表: [
          article('gone.md'),
          article('notes.txt'),
          article('a/b.md'),
          article('kept.md', { '创建时间（时间戳）': 2 }),
          article('kept.md'),
        ],
      },
      { 'data/articles/notes.txt': 'notes', 'data/articles/kept.md': 'Kept\n', 'data/articles/stray.md': 'Stray\n' },
    )

    const { messages, site } = await migrate(vfs)

    expect(await vfs.readFile('data/articles/notes.txt')).toBe('notes')
    expect(await vfs.readFile('data/articles/stray.md')).toBe('---\ntitle: stray\ndraft: true\n---\n\nStray\n')
    expect((await manifestOf(vfs, site)).articles.map(entry => entry.slug)).toEqual(['kept'])
    expect(messages).toEqual([
      'data/index.json: data/articles/gone.md is missing; its entry was dropped',
      'data/index.json: data/articles/notes.txt is not a .md file; its entry was dropped',
      'data/index.json: "a/b.md" is not a file directly in data/articles, which is all bbg-next reads; its entry was dropped',
      'data/index.json: data/articles/kept.md is listed twice; its entry was dropped',
      'data/articles/stray.md: Was in no list of the old editor, so never shown: kept as a draft',
      expect.stringContaining('licence'),
    ])
  })
})

describe('pages', () => {
  it('keep their place in the nav, their label and whether they are in it at all', async () => {
    const vfs = oldSite(
      {
        页面列表: [
          page('Q3xkP7mWc2Rt.md', { 页面标题: '关于', '若显示在菜单中，则在菜单中显示为': '关于我' }),
          page('aaa.md', { 页面标题: 'Links', 是否显示在菜单中: false, 启用评论: true }),
        ],
      },
      { 'data/pages/Q3xkP7mWc2Rt.md': 'About\n', 'data/pages/aaa.md': 'Links\n' },
    )

    const { site } = await migrate(vfs)

    const { pages } = await manifestOf(vfs, site)
    expect(pages.map(entry => [entry.slug, entry.navLabel, entry.showInNav, entry.comments])).toEqual([
      ['Q3xkP7mWc2Rt', '关于我', true, false],
      ['aaa', 'Links', false, true],
    ])
  })

  it('of raw HTML are left as they are', async () => {
    const vfs = oldSite(
      { 页面列表: [page('raw.html', { 这是一个完整的html: true })] },
      { 'data/pages/raw.html': '<p>' },
    )

    const { messages } = await migrate(vfs)

    expect(await vfs.readFile('data/pages/raw.html')).toBe('<p>')
    expect(messages).toContain(
      'data/pages/raw.html: A page of raw HTML, which bbg-next cannot show among its pages: left as it is, still at its own address',
    )
  })
})

describe('the friends page', () => {
  const friends = [
    { 名称: '小明', 链接: 'https://xm.example', 简介: '写\n代码的', 图标: 'https://xm.example/a.png' },
    { 名称: 'B', 链接: 'https://b.example', 简介: '', 图标: '' },
  ]

  it('holds the friends in a bbg-friends fence, after the pages, and is where old links to it go', async () => {
    const vfs = oldSite(
      { 页面列表: [page('about.md')], 友人帐: friends, 友人帐页面附加信息: '常来玩', 友人帐页面允许评论: false },
      { 'data/pages/about.md': 'About\n' },
    )

    const { site } = await migrate(vfs)

    expect(await vfs.readFile('data/pages/friends.md')).toBe(
      '---\ntitle: 友人帐\nnavOrder: 2\ncomments: false\n---\n\n常来玩\n\n```bbg-friends\nname: 小明\nurl: https://xm.example\navatar: https://xm.example/a.png\ndescription: 写 代码的\n\nname: B\nurl: https://b.example\n```\n',
    )
    expect(await vfs.readFile('data/plugins/legacy-routes.json')).toBe('{\n  "friends": "friends"\n}\n')
    expect(site.plugins).toContain('friends')
    expect((await manifestOf(vfs, site)).pages.map(entry => entry.slug)).toEqual(['about', 'friends'])
  })

  it('takes a name no page has', async () => {
    const vfs = oldSite({ 页面列表: [page('friends.md')], 友人帐: friends }, { 'data/pages/friends.md': 'Mine\n' })

    const { site } = await migrate(vfs)

    expect(await vfs.readFile('data/plugins/legacy-routes.json')).toBe('{\n  "friends": "friends-2"\n}\n')
    expect((await manifestOf(vfs, site)).pages.map(entry => entry.slug)).toEqual(['friends', 'friends-2'])
  })
})

describe('settings', () => {
  it('become the site’s, the old file going', async () => {
    const vfs = oldSite({
      博客标题: 'Old blog',
      '博客描述（副标题）': 'Hello',
      网站语言: 'English',
      '底部信息（格式为markdown）': '© **me**',
      文章列表中每页的文章数为: '5',
      '网站域名（包括https://）': 'https://me.github.io/blog/index.html',
      在对文章列表进行修改后触发rss生成: true,
      全局主题设置: { 标题栏背景颜色: '#E8590C' },
    })

    const { site } = await migrate(vfs)

    expect(site).toMatchObject({
      title: 'Old blog',
      description: 'Hello',
      lang: 'en',
      footer: '© **me**',
      articlesPerPage: 5,
      url: 'https://me.github.io',
      router: { mode: 'hash', base: '/blog/' },
      atom: true,
      sitemap: false,
      seed: '#E8590C',
      theme: 'default-theme',
    })
    expect(await vfs.exists('data/index.json')).toBe(false)
  })

  it('switch on the plugins for what the old site showed', async () => {
    const vfs = oldSite({
      启用网站公告: true,
      网站公告仅在首页显示: false,
      网站公告: 'Hi **all**',
      全局评论设置: { 启用waline评论: true, waline设置: { serverurl: 'https://waline.example' } },
      全局主题设置: {
        是否使用背景图像: true,
        '若使用背景图像，设置为': { '将网站根目录下的background.webp作为背景图像': true },
      },
    })

    const { site } = await migrate(vfs)

    expect(site.plugins).toEqual(['legacy-routes', 'announcement', 'image-viewer', 'waline'])
    expect(JSON.parse(await vfs.readFile('data/plugins/announcement.json'))).toEqual({
      text: 'Hi **all**',
      routes: ['home', 'article', 'page'],
    })
    expect(JSON.parse(await vfs.readFile('data/plugins/waline.json'))).toEqual({ serverURL: 'https://waline.example' })
    expect(JSON.parse(await vfs.readFile('data/themes/default-theme.json'))).toEqual({ wallpaper: 'background.webp' })
  })
})

describe('encrypted', () => {
  it('a whole article is opened with its password and locked again the bbg-next way', async () => {
    const vfs = oldSite(
      { 文章列表: [article('s.md', { 文章标题: '秘密', 是否加密: true })] },
      { 'data/articles/s.md': lockedArticle },
    )
    const { ask, asked } = answering('wrong', 'hunter2')

    await migrate(vfs, ask)

    expect(asked).toEqual([
      'Password for "秘密" (data/articles/s.md), empty to skip: ',
      'Wrong password. Password for "秘密" (data/articles/s.md), empty to skip: ',
    ])
    const migrated = await vfs.readFile('data/articles/s.md')
    expect(migrated).toMatch(/^---\ntitle: 秘密\n---\n\n```bbg-encrypted\n/)
    expect(await decryptDocument(migrated, 'hunter2')).toContain('只给知道密码的人看，[附件](../../notes.pdf)。')
  })

  it('a whole article left locked is kept as a draft', async () => {
    const vfs = oldSite({ 文章列表: [article('s.md', { 是否加密: true })] }, { 'data/articles/s.md': lockedArticle })

    const { messages } = await migrate(vfs, answering('').ask)

    expect(await vfs.readFile('data/articles/s.md')).toBe(`---\ntitle: s.md\ndraft: true\n---\n\n${lockedArticle}`)
    expect(messages).toContain(
      "data/articles/s.md: Still encrypted in the old editor's format, which bbg-next cannot open, so it is kept as a draft",
    )
  })

  it('a block within a page is opened with its own password and locked again', async () => {
    const body = `Open part.\n\n<partial_encrypted>\n${lockedBlock}\n</partial_encrypted>\n`
    const vfs = oldSite({ 页面列表: [page('p.md')] }, { 'data/pages/p.md': body })

    await migrate(vfs, answering('swordfish').ask)

    const migrated = await vfs.readFile('data/pages/p.md')
    expect(migrated).toContain('Open part.\n\n```bbg-encrypted\n')
    expect(migrated).not.toContain('partial_encrypted')
    expect(await decryptDocument(migrated, 'swordfish')).toContain('Open part.\n\n藏起来的一段\n')
  })

  it('an article marked encrypted but holding plain text is kept as a draft', async () => {
    const vfs = oldSite({ 文章列表: [article('s.md', { 是否加密: true })] }, { 'data/articles/s.md': 'Plain\n' })

    const { messages } = await migrate(vfs)

    expect(await vfs.readFile('data/articles/s.md')).toContain('draft: true')
    expect(messages).toContainEqual(expect.stringContaining('Marked encrypted but holds plain text'))
  })
})

describe('what was written for the old theme', () => {
  it('is reported and left as it is, and code is never read', async () => {
    const old = '<info-hint>Hi</info-hint> said<ref url="https://x">X</ref> $a^2$ <iframe src="x"></iframe>\n'
    const sample = '```\n<warning-hint>shown as code</warning-hint> $1 and $2\n```\n\n`<ref>` in `$code$`\n'
    const vfs = oldSite(
      { 文章列表: [article('old.md'), article('sample.md')] },
      { 'data/articles/old.md': old, 'data/articles/sample.md': sample },
    )

    const { messages } = await migrate(vfs)

    expect(await vfs.readFile('data/articles/old.md')).toContain(old)
    expect(messages.filter(message => message.includes('Shows as written'))).toEqual([
      'data/articles/old.md: Shows as written in bbg-next: hint boxes, <ref>, HTML (<iframe>)',
    ])
  })

  it('switches on the plugins that colour code and typeset formulas, as the old theme did', async () => {
    const vfs = oldSite(
      { 文章列表: [article('code.md'), article('maths.md')] },
      { 'data/articles/code.md': '```js\nconst a = 1\n```\n', 'data/articles/maths.md': 'So $a^2+b^2=c^2$.\n' },
    )

    expect((await migrate(vfs)).site.plugins).toEqual(['legacy-routes', 'image-viewer', 'highlight', 'math'])
  })

  it('takes no price for a formula, nor one on a page, where the old theme never typeset them', async () => {
    const vfs = oldSite(
      { 文章列表: [article('shop.md')], 页面列表: [page('about.md')] },
      { 'data/articles/shop.md': 'It costs $5 and $10.\n', 'data/pages/about.md': 'So $a^2$.\n' },
    )

    expect((await migrate(vfs)).site.plugins).not.toContain('math')
  })

  it('links relatively from the site root, and images from beside the document unless told otherwise', async () => {
    const body = '[cv](resume.pdf) ![p](pic.png) [a](https://x.example) [b](#top) [c](/abs) `[d](code.md)`\n'
    const files = { 'data/articles/a.md': body }

    const beside = oldSite({ 文章列表: [article('a.md')] }, files)
    await migrate(beside)
    expect(await beside.readFile('data/articles/a.md')).toContain(
      '[cv](../../resume.pdf) ![p](pic.png) [a](https://x.example) [b](#top) [c](/abs) `[d](code.md)`',
    )

    const fromRoot = oldSite(
      { 文章列表: [article('a.md')], Markdown渲染配置: { 使用markdown文件所在目录作为baseurl: false } },
      files,
    )
    await migrate(fromRoot)
    expect(await fromRoot.readFile('data/articles/a.md')).toContain('![p](../../pic.png)')
  })
})

describe('waline comments', () => {
  it('is told each old address that took comments and its new one, both as Waline stores them', async () => {
    const vfs = oldSite(
      {
        文章列表: [article('my article.md'), article('你好.md'), article('quiet.md', { 启用评论: false })],
        页面列表: [page('Q3.md', { 启用评论: true })],
        友人帐: [{ 名称: 'B', 链接: 'https://b.example' }],
        全局评论设置: { 启用waline评论: true, waline设置: { serverurl: 'https://waline.example' } },
      },
      {
        'data/articles/my article.md': 'A\n',
        'data/articles/你好.md': 'B\n',
        'data/articles/quiet.md': 'C\n',
        'data/pages/Q3.md': 'D\n',
      },
    )

    const { messages } = await migrate(vfs)

    expect(messages).toContain(
      [
        'data/index.json: Waline files comments under the address of the article or page they are on, and each has a new address now. Change the url of the comments in the Waline database from each old address to its new one, or they no longer show:',
        '  article=my article.md → /article/my-article/',
        '  article=你好.md → /article/你好/',
        '  page=Q3.md → /page/Q3/',
        '  internal=friendbook → /page/friends/',
      ].join('\n'),
    )
  })
})

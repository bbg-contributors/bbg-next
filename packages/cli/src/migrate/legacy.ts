import type { Vfs } from '@bbg-next/core'
import { dataDir } from '@bbg-next/core'

// data/index.json as the old bbg editor wrote it. A key only later versions wrote falls back to the value their own upgrade gave it.

export const legacyIndexPath = `${dataDir}/index.json`

type Json = Readonly<Record<string, unknown>>

export interface LegacyArticle {
  readonly file: string
  readonly title: string
  readonly tags: readonly string[]
  readonly excerpt: string
  /** Epoch ms, `null` when never set. */
  readonly created: number | null
  readonly updated: number | null
  readonly pinned: boolean
  readonly hidden: boolean
  readonly comments: boolean
  readonly encrypted: boolean
}

export interface LegacyPage {
  readonly file: string
  readonly title: string
  readonly inNav: boolean
  readonly navLabel: string
  readonly comments: boolean
  /** Opened as a file of its own rather than rendered as markdown. */
  readonly standalone: boolean
}

interface LegacyFriend {
  readonly name: string
  readonly url: string
  readonly avatar: string
  readonly description: string
}

export interface LegacySite {
  readonly title: string
  readonly description: string
  readonly lang: 'zh-CN' | 'en' | 'ja'
  readonly footer: string
  readonly articlesPerPage: number
  readonly domain: string
  readonly atom: boolean
  readonly sitemap: boolean
  readonly articles: readonly LegacyArticle[]
  readonly pages: readonly LegacyPage[]
  readonly friends: {
    readonly enabled: boolean
    readonly info: string
    readonly list: readonly LegacyFriend[]
    /** The JSON file the list came from instead, `''` for none. */
    readonly source: string
    readonly comments: boolean
  }
  readonly announcement: { readonly enabled: boolean; readonly homeOnly: boolean; readonly text: string }
  readonly menuLinks: readonly string[]
  readonly theme: {
    /** What a third-party theme brought into the site, `null` while the official one was in use. */
    readonly thirdParty: readonly string[] | null
    readonly bar: string
    readonly barText: string
    readonly link: string
    readonly solidBackground: string
    readonly wallpaper: string
    readonly live2d: boolean
  }
  /** `waline` is its server, `''` when off. */
  readonly comments: { readonly valine: boolean; readonly disqus: boolean; readonly waline: string }
  /** Custom CSS or JS. */
  readonly customCode: boolean
  readonly customText: boolean
  readonly licence: boolean
  /** Relative images resolve against the document's own directory rather than the site root. */
  readonly imagesBesideDocument: boolean
  readonly imageViewer: boolean
}

const languages: Readonly<Record<string, LegacySite['lang']>> = { 简体中文: 'zh-CN', English: 'en', 日本語: 'ja' }

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function text(from: Json, key: string, fallback = ''): string {
  const value = from[key]

  return typeof value === 'string' ? value : fallback
}

function flag(from: Json, key: string, fallback: boolean): boolean {
  const value = from[key]

  return typeof value === 'boolean' ? value : fallback
}

function group(from: Json, key: string): Json {
  const value = from[key]

  return isObject(value) ? value : {}
}

function list(from: Json, key: string): readonly Json[] {
  const value = from[key]

  return Array.isArray(value) ? value.filter(isObject) : []
}

function strings(from: Json, key: string): readonly string[] {
  const value = from[key]

  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim() !== '')
    : []
}

// Epoch ms since 20240518. Before that the editor kept a date, which its own upgrade turned into 8:00 that morning by adding eight hours, as this does.
function timestamp(entry: Json, key: string, dateKey: string): number | null {
  const value = entry[key]
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : null

  const date = entry[dateKey]
  const ms = typeof date === 'string' ? Date.parse(date) + 28_800_000 : Number.NaN

  return Number.isFinite(ms) ? ms : null
}

function article(entry: Json): LegacyArticle {
  return {
    file: text(entry, '文件名'),
    title: text(entry, '文章标题').trim(),
    tags: strings(entry, '标签'),
    excerpt: text(entry, '摘要').trim(),
    created: timestamp(entry, '创建时间（时间戳）', '创建日期'),
    updated: timestamp(entry, '修改时间（时间戳）', '修改日期'),
    pinned: flag(entry, '是否置顶', false),
    hidden: flag(entry, '是否隐藏', false),
    comments: flag(entry, '启用评论', false),
    encrypted: flag(entry, '是否加密', false),
  }
}

function page(entry: Json): LegacyPage {
  return {
    file: text(entry, '文件名'),
    title: text(entry, '页面标题').trim(),
    inNav: flag(entry, '是否显示在菜单中', true),
    navLabel: text(entry, '若显示在菜单中，则在菜单中显示为').trim(),
    comments: flag(entry, '启用评论', false),
    standalone: flag(entry, '这是一个完整的html', false),
  }
}

function friend(entry: Json): LegacyFriend {
  return {
    name: text(entry, '名称'),
    url: text(entry, '链接'),
    avatar: text(entry, '图标'),
    description: text(entry, '简介'),
  }
}

function theme(blog: Json): LegacySite['theme'] {
  const settings = group(blog, '全局主题设置')
  const background = group(settings, '若使用背景图像，设置为')
  const solid = flag(settings, '是否使用纯色背景（优先级高于背景图像）', false)
    ? text(settings, '若使用纯色背景，颜色为').trim()
    : ''
  const image = !flag(settings, '是否使用背景图像', false)
    ? ''
    : flag(background, '将网站根目录下的background.webp作为背景图像', false)
      ? 'background.webp'
      : flag(background, '将某个url作为背景图像', false)
        ? text(background, '若将某个url作为背景图像，这个url是').trim()
        : ''

  return {
    thirdParty: flag(settings, '是否使用第三方主题', false) ? strings(settings, '第三方主题文件内容') : null,
    bar: text(settings, '标题栏背景颜色', '#0d6efd').trim(),
    barText: text(settings, '标题栏文字颜色', 'white').trim(),
    link: text(settings, '链接颜色', '#0d6efd').trim(),
    solidBackground: solid,
    // The solid colour goes over any image.
    wallpaper: solid === '' ? image : '',
    live2d: flag(settings, '是否启用live2d-widget', false),
  }
}

/** Throws on a file too broken to migrate from, before anything is written. */
export async function readLegacySite(vfs: Vfs): Promise<LegacySite> {
  let blog: unknown
  try {
    blog = JSON.parse(await vfs.readFile(legacyIndexPath))
  } catch (cause) {
    throw new Error(`${legacyIndexPath} is not valid JSON: ${(cause as Error).message}`)
  }

  if (!isObject(blog)) throw new Error(`${legacyIndexPath} does not hold a bbg site`)
  for (const key of ['文章列表', '页面列表']) {
    if (blog[key] !== undefined && !Array.isArray(blog[key]))
      throw new Error(`${key} in ${legacyIndexPath} is not a list`)
  }

  const comments = group(blog, '全局评论设置')
  const markdown = group(blog, 'Markdown渲染配置')
  const perPage = Number(blog['文章列表中每页的文章数为'])

  return {
    title: text(blog, '博客标题').trim(),
    description: text(blog, '博客描述（副标题）'),
    lang: languages[text(blog, '网站语言')] ?? 'zh-CN',
    footer: text(blog, '底部信息（格式为markdown）'),
    articlesPerPage: Number.isInteger(perPage) && perPage >= 1 ? perPage : 10,
    domain: text(blog, '网站域名（包括https://）').trim(),
    atom: flag(blog, '在对文章列表进行修改后触发rss生成', false),
    sitemap: flag(blog, '在对文章或页面列表进行修改后触发sitemap.txt生成', false),
    articles: list(blog, '文章列表').map(article),
    pages: list(blog, '页面列表').map(page),
    friends: {
      enabled: flag(blog, '启用内建友人帐页面', true),
      info: text(blog, '友人帐页面附加信息').trim(),
      list: list(blog, '友人帐').map(friend),
      source: flag(blog, '友人帐来自json文件', false) ? text(blog, '若友人帐来自json文件，则地址为').trim() : '',
      comments: flag(blog, '友人帐页面允许评论', true),
    },
    announcement: {
      enabled: flag(blog, '启用网站公告', false),
      homeOnly: flag(blog, '网站公告仅在首页显示', true),
      text: text(blog, '网站公告').trim(),
    },
    menuLinks: list(blog, '菜单中的外部链接').map(link => text(link, '显示名称')),
    theme: theme(blog),
    comments: {
      valine: flag(comments, '启用valine评论', false),
      disqus: flag(comments, '启用disqus评论', false),
      waline: flag(comments, '启用waline评论', false) ? text(group(comments, 'waline设置'), 'serverurl').trim() : '',
    },
    customCode:
      (flag(blog, '启用自定义CSS', false) && text(blog, '自定义CSS').trim() !== '') ||
      (flag(blog, '启用自定义JS', false) && text(blog, '自定义JS').trim() !== ''),
    customText:
      flag(group(blog, '自定义界面文本'), '启用', false) && list(group(blog, '自定义界面文本'), '列表').length > 0,
    licence: !flag(blog, '不使用全站内容授权协议', false),
    imagesBesideDocument: flag(markdown, '使用markdown文件所在目录作为baseurl', true),
    imageViewer: flag(markdown, '在用户点击图片时显示图片查看器', true),
  }
}

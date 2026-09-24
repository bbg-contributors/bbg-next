// The old theme's own wording, chosen by the site language the shell puts on `<html lang>`.

export interface Labels {
  readonly articles: string
  readonly archive: string
  readonly byTag: string
  readonly byYear: string
  readonly untagged: string
  /** Either side of the tag in its page's title. */
  readonly tagged: readonly [before: string, after: string]
  /** An archive entry's dates go between the outer two, parted by the middle one. */
  readonly aside: readonly [open: string, separator: string, close: string]
  readonly pinned: string
  readonly created: string
  readonly updated: string
  readonly tags: string
  readonly empty: string
  readonly unlisted: string
  readonly pageOf: (page: number, total: number) => string
  /** The original spelt dates out for Chinese only, and kept them numeric otherwise. */
  readonly month: 'long' | 'numeric'
  readonly settings: string
  readonly darkMode: string
  readonly followSystem: string
  readonly light: string
  readonly dark: string
  readonly menu: string
  readonly close: string
  readonly backToTop: string
}

const zh: Labels = {
  articles: '文章列表',
  archive: '归档和标签',
  byTag: '按标签检索',
  byYear: '按年份检索',
  untagged: '未分类文章',
  tagged: ['标签为', '下的文章'],
  aside: ['（', '，', '）'],
  pinned: '置顶文章',
  created: '此文章编写于',
  updated: '最近修改于',
  tags: '标签',
  empty: '还没有文章。',
  unlisted: '隐藏文章',
  pageOf: (page, total) => `你当前正在浏览文章列表的第${page}页（共${total}页）。`,
  month: 'long',
  settings: '主题设置',
  darkMode: '暗色模式设置',
  followSystem: '跟随系统',
  light: '亮色模式',
  dark: '暗色模式',
  menu: '菜单',
  close: '关闭',
  backToTop: '回到顶部',
}

const ja: Labels = {
  articles: '記事一覧',
  archive: 'アーカイブとタグ',
  byTag: 'タグで探す',
  byYear: '年で探す',
  untagged: 'タグのない記事',
  tagged: ['タグ', 'の記事'],
  aside: ['（', '、', '）'],
  pinned: '固定記事',
  created: '作成日',
  updated: '修正日',
  tags: 'タグ',
  empty: 'まだ記事がありません。',
  unlisted: '限定公開',
  pageOf: (page, total) => `記事一覧の ${page} / ${total} ページを表示しています。`,
  month: 'numeric',
  settings: 'テーマ設定',
  darkMode: 'ダークモード設定',
  followSystem: 'システムに従う',
  light: 'ライトモード',
  dark: 'ダークモード',
  menu: 'メニュー',
  close: '閉じる',
  backToTop: 'トップへ戻る',
}

const en: Labels = {
  articles: 'Article List',
  archive: 'Archive and tags',
  byTag: 'By tag',
  byYear: 'By year',
  untagged: 'Untagged articles',
  tagged: ['Articles tagged', ''],
  aside: [' (', ', ', ')'],
  pinned: 'Pinned',
  created: 'This article is written at',
  updated: 'Last modified at',
  tags: 'Tags:',
  empty: 'No articles yet.',
  unlisted: 'Unlisted',
  pageOf: (page, total) => `You are browsing page ${page} of ${total} of the article list.`,
  month: 'numeric',
  settings: 'Theme settings',
  darkMode: 'Dark mode',
  followSystem: 'Follow system',
  light: 'Light mode',
  dark: 'Dark mode',
  menu: 'Menu',
  close: 'Close',
  backToTop: 'Back to top',
}

export function labels(): Labels {
  const lang = document.documentElement.lang.toLowerCase()
  if (lang.startsWith('zh')) return zh
  if (lang.startsWith('ja')) return ja

  return en
}

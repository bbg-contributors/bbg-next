// The runtime's own words: the titles of the views it names, what it says when nothing is found, and the password box.

export interface Wording {
  readonly archive: string
  readonly tagged: (tag: string) => string
  readonly notFound: string
  readonly noSuchRoute: string
  readonly noSuchListPage: string
  readonly noSuchTag: string
  readonly noSuchArticle: string
  readonly noSuchPage: string
  readonly locked: string
  readonly password: string
  readonly unlock: string
  readonly wrongPassword: string
  readonly damaged: string
}

const zh: Wording = {
  archive: '归档和标签',
  tagged: tag => `标签为 #${tag} 下的文章`,
  notFound: '未找到',
  noSuchRoute: '此页面不存在。',
  noSuchListPage: '文章列表没有这一页。',
  noSuchTag: '没有文章带有这个标签。',
  noSuchArticle: '此文章不存在或已被删除。',
  noSuchPage: '此页面不存在或已被删除。',
  locked: '此内容受密码保护。',
  password: '请输入密码',
  unlock: '查看内容',
  wrongPassword: '密码不正确，请重试。',
  damaged: '这段加密内容已损坏，无法打开。',
}

const ja: Wording = {
  archive: 'アーカイブとタグ',
  tagged: tag => `タグ #${tag} の記事`,
  notFound: '見つかりません',
  noSuchRoute: 'このページは存在しません。',
  noSuchListPage: '記事一覧にこのページはありません。',
  noSuchTag: 'このタグの記事はありません。',
  noSuchArticle: 'この記事は存在しないか、削除されました。',
  noSuchPage: 'このページは存在しないか、削除されました。',
  locked: 'この内容はパスワードで保護されています。',
  password: 'パスワード',
  unlock: '表示',
  wrongPassword: 'パスワードが違います。',
  damaged: 'この暗号化された内容は壊れています。',
}

const en: Wording = {
  archive: 'Archive and tags',
  tagged: tag => `Articles tagged #${tag}`,
  notFound: 'Not found',
  noSuchRoute: 'This page does not exist.',
  noSuchListPage: 'This page of the article list does not exist.',
  noSuchTag: 'No listed article carries this tag.',
  noSuchArticle: 'This article does not exist or has been deleted.',
  noSuchPage: 'This page does not exist or has been deleted.',
  locked: 'This content is password protected.',
  password: 'Password',
  unlock: 'Show',
  wrongPassword: 'Wrong password, try again.',
  damaged: 'This encrypted content is damaged.',
}

/** By the site's language, the way the default theme picks its own. */
export function wordingFor(lang: string): Wording {
  const tag = lang.toLowerCase()
  if (tag.startsWith('zh')) return zh
  if (tag.startsWith('ja')) return ja

  return en
}

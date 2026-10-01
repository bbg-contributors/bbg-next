import type { AskPassword } from '../terminal/tty.ts'
import type { LegacyArticle, LegacyPage, LegacySite } from './legacy.ts'
import type { SjclPayload } from './sjcl.ts'
import type { Diagnostic, Vfs } from '@bbg-next/core'
import {
  articlesDir,
  encryptBlock,
  encryptDocument,
  isValidSlug,
  pagesDir,
  slugify,
  stringifyFrontMatter,
} from '@bbg-next/core'
import { legacyIndexPath } from './legacy.ts'
import { hasCodeBlocks, hasFormulas, legacySyntax, rebaseLinks, replaceOutsideCode } from './markdown.ts'
import { openSjcl, parseSjcl } from './sjcl.ts'

const extension = '.md'
const byteOrderMark = /^\uFEFF/
const trailingNewline = /\n$/
const whitespace = /\s+/g
const partialBlock = /<partial_encrypted>([\s\S]*?)<\/partial_encrypted>/g
// Written by the old editor in 2023, and opened by no version of its theme.
const cryptoJs = /^\{\s*"type"\s*:\s*"AES-256"/

const friendsTitles = { 'zh-CN': '友人帐', en: 'Friend book', ja: '友人帳' } as const

export interface MigratedDocuments {
  /** Path to what goes there. */
  readonly writes: ReadonlyMap<string, string>
  /** The friends page's slug, `null` without one. */
  readonly friends: string | null
  /** Each old comment thread's key, as the old theme gave it to Waline or Rustaline, and the new key, for every view that took comments. */
  readonly threads: readonly (readonly [string, string])[]
  /** Whether any document shows code, and any article a formula: what the old theme coloured and typeset. */
  readonly seen: { readonly code: boolean; readonly formulas: boolean }
}

interface Context {
  readonly vfs: Vfs
  readonly site: LegacySite
  readonly ask: AskPassword
  readonly diagnostics: Diagnostic[]
  readonly seen: { code: boolean; formulas: boolean }
}

function warn(context: Context, file: string, message: string): void {
  context.diagnostics.push({ level: 'warn', file, message })
}

function stemOf(file: string): string {
  return file.slice(0, -extension.length)
}

async function read(context: Context, path: string): Promise<string> {
  return (await context.vfs.readFile(path)).replace(byteOrderMark, '')
}

/** The entries bbg-next can take over as they are; the others are reported and their files left alone. */
function usable<Entry extends LegacyArticle | LegacyPage>(
  context: Context,
  entries: readonly Entry[],
  dir: string,
  present: readonly string[],
): Entry[] {
  const seen = new Set<string>()

  return entries.filter(({ file }) => {
    const problem =
      file === '' || file.includes('/') || file.includes('\\')
        ? `${JSON.stringify(file)} is not a file directly in ${dir}, which is all bbg-next reads`
        : !present.includes(file)
          ? `${dir}/${file} is missing`
          : !file.endsWith(extension)
            ? `${dir}/${file} is not a ${extension} file`
            : seen.has(file)
              ? `${dir}/${file} is listed twice`
              : null
    if (problem === null) {
      seen.add(file)

      return true
    }

    warn(context, legacyIndexPath, `${problem}; its entry was dropped`)

    return false
  })
}

/** Each file's slug: its own name where that is one, else one made from it that no other file has. */
function slugsFor(files: readonly string[], fallback: string): Map<string, string> {
  const taken = new Set(files.map(stemOf).filter(isValidSlug))
  const slugs = new Map<string, string>()

  for (const file of files) {
    const stem = stemOf(file)
    if (isValidSlug(stem)) {
      slugs.set(file, stem)
      continue
    }

    const base = slugify(stem) || fallback
    let slug = base
    for (let n = 2; taken.has(slug); n += 1) slug = `${base}-${n}`
    taken.add(slug)
    slugs.set(file, slug)
  }

  return slugs
}

/** Asks until a password opens `payload`; `null` once skipped or out of input. */
async function unlock(
  context: Context,
  what: string,
  payload: SjclPayload,
): Promise<{ password: string; text: string } | null> {
  let question = `Password for ${what}, empty to skip: `
  for (;;) {
    const password = await context.ask(question)
    if (password === null || password === '') return null

    const text = openSjcl(payload, password)
    if (text !== null) return { password, text }
    question = `Wrong password. Password for ${what}, empty to skip: `
  }
}

/** The old editor's partial blocks, each behind a password of its own, as bbg-next's; one left locked stays as it was. */
async function openPartialBlocks(context: Context, body: string, what: string, path: string): Promise<string> {
  let count = 0

  return replaceOutsideCode(body, partialBlock, async (block, json) => {
    count += 1
    const payload = parseSjcl(json.trim())
    const opened = payload === null ? null : await unlock(context, `block ${count} of ${what}`, payload)
    if (opened === null) {
      warn(context, path, `Encrypted block ${count} is still in the old editor's format, which bbg-next shows as text`)

      return block
    }

    return (await encryptBlock(opened.text, opened.password)).replace(trailingNewline, '')
  })
}

/** Notes what the old theme drew, reports what only it could, and points relative links where it resolved them. */
function carryOver(context: Context, body: string, path: string, article: boolean): string {
  if (hasCodeBlocks(body)) context.seen.code = true
  // The old theme typeset formulas in articles alone.
  if (article && hasFormulas(body)) context.seen.formulas = true

  const found = legacySyntax(body)
  if (found.length > 0) warn(context, path, `Shows as written in bbg-next: ${found.join(', ')}`)

  return rebaseLinks(body, context.site.imagesBesideDocument)
}

function untitled(context: Context, path: string): void {
  warn(context, path, 'Had no title, so it is titled by its file name')
}

async function migrateArticle(context: Context, entry: LegacyArticle, slug: string): Promise<string> {
  const path = `${articlesDir}/${entry.file}`
  const source = await read(context, path)
  const stem = stemOf(entry.file)
  if (entry.title === '') untitled(context, path)

  const iso = (ms: number): string => new Date(ms).toISOString()
  const front = {
    title: entry.title || stem,
    ...(slug === stem ? {} : { slug }),
    ...(entry.tags.length > 0 ? { tags: entry.tags } : {}),
    ...(entry.created === null ? {} : { created: iso(entry.created) }),
    ...(entry.updated === null || entry.updated === entry.created ? {} : { updated: iso(entry.updated) }),
    ...(entry.pinned ? { pinned: true } : {}),
    ...(entry.hidden ? { hidden: true } : {}),
    ...(entry.excerpt === '' ? {} : { excerpt: entry.excerpt }),
    ...(entry.comments ? {} : { comments: false }),
  }
  const what = `"${front.title}" (${path})`
  const draft = (message: string): string => {
    warn(context, path, `${message}, so it is kept as a draft`)

    return stringifyFrontMatter({ ...front, draft: true }, source)
  }

  const payload = parseSjcl(source.trim())
  if (payload !== null) {
    const opened = await unlock(context, what, payload)
    if (opened === null) return draft("Still encrypted in the old editor's format, which bbg-next cannot open")

    return encryptDocument(stringifyFrontMatter(front, carryOver(context, opened.text, path, true)), opened.password)
  }
  if (cryptoJs.test(source.trim())) return draft('Encrypted in a format no version of the old theme could open')
  // The old editor left a file open like this when it crashed mid-edit: the author still takes it for locked.
  if (entry.encrypted) return draft('Marked encrypted but holds plain text; encrypt it with `bbg-next encrypt`')

  const opened = await openPartialBlocks(context, source, what, path)

  return stringifyFrontMatter(front, carryOver(context, opened, path, true))
}

async function migratePage(context: Context, entry: LegacyPage, slug: string, navOrder: number): Promise<string> {
  const path = `${pagesDir}/${entry.file}`
  const source = await read(context, path)
  const stem = stemOf(entry.file)
  if (entry.title === '') untitled(context, path)

  const title = entry.title || stem
  const front = {
    title,
    ...(slug === stem ? {} : { slug }),
    ...(entry.inNav ? {} : { showInNav: false }),
    ...(entry.navLabel === '' || entry.navLabel === title ? {} : { navLabel: entry.navLabel }),
    navOrder,
    ...(entry.comments ? {} : { comments: false }),
  }
  const opened = await openPartialBlocks(context, source, `"${title}" (${path})`, path)

  return stringifyFrontMatter(front, carryOver(context, opened, path, false))
}

function friendsBody(friends: LegacySite['friends']): string {
  const line = (value: string): string => value.replace(whitespace, ' ').trim()
  const blocks =
    friends.source === ''
      ? friends.list.map(friend =>
          [
            `name: ${line(friend.name)}`,
            `url: ${line(friend.url)}`,
            ...(line(friend.avatar) === '' ? [] : [`avatar: ${line(friend.avatar)}`]),
            ...(line(friend.description) === '' ? [] : [`description: ${line(friend.description)}`]),
          ].join('\n'),
        )
      : [`source: ${friends.source}`]

  return `${[
    ...(friends.info === '' ? [] : [friends.info]),
    ...(blocks.length === 0 ? [] : [`\`\`\`bbg-friends\n${blocks.join('\n\n')}\n\`\`\``]),
  ].join('\n\n')}\n`
}

/** A page for the old built-in friends page, when it had anything on it, named clear of every page there is. */
function friendsPage(
  context: Context,
  present: readonly string[],
  slugs: ReadonlyMap<string, string>,
): { readonly file: string; readonly content: string } | null {
  const { friends, lang, pages } = context.site
  if (!friends.enabled || (friends.list.length === 0 && friends.source === '' && friends.info === '')) return null

  const taken = new Set(slugs.values())
  let name = 'friends'
  for (let n = 2; taken.has(name) || present.includes(`${name}${extension}`); n += 1) name = `friends-${n}`
  const file = `${name}${extension}`
  const path = `${pagesDir}/${file}`

  if (friends.source !== '') {
    warn(
      context,
      path,
      `The friends list comes from ${friends.source}, which the friends plugin reads only as a JSON array of { "name", "url", "avatar", "description" }: rewrite that file`,
    )
  }
  const found = legacySyntax(friends.info)
  if (found.length > 0) warn(context, path, `Shows as written in bbg-next: ${found.join(', ')}`)

  const front = {
    title: friendsTitles[lang],
    // Right after the pages, where the old nav had it.
    navOrder: pages.length + 1,
    ...(friends.comments ? {} : { comments: false }),
  }

  return { file, content: stringifyFrontMatter(front, friendsBody(friends)) }
}

/** The `.md` files no entry names: the old theme never showed them. */
function unlisted(present: readonly string[], entries: readonly (LegacyArticle | LegacyPage)[]): string[] {
  const named = new Set(entries.map(entry => entry.file))

  return present.filter(file => file.endsWith(extension) && !file.startsWith('.') && !named.has(file))
}

async function keepAsDrafts(
  context: Context,
  dir: string,
  files: readonly string[],
  writes: Map<string, string>,
): Promise<void> {
  for (const file of files) {
    const path = `${dir}/${file}`
    writes.set(path, stringifyFrontMatter({ title: stemOf(file), draft: true }, await read(context, path)))
    warn(context, path, 'Was in no list of the old editor, so never shown: kept as a draft')
  }
}

/** Everything but the site's settings; asks for passwords as it goes and writes nothing itself. */
export async function migrateDocuments(
  vfs: Vfs,
  site: LegacySite,
  ask: AskPassword,
  diagnostics: Diagnostic[],
): Promise<MigratedDocuments> {
  const context: Context = { vfs, site, ask, diagnostics, seen: { code: false, formulas: false } }
  const writes = new Map<string, string>()
  const threads: [string, string][] = []

  const articleFiles = await vfs.list(articlesDir)
  const articles = usable(context, site.articles, articlesDir, articleFiles)
  const strayArticles = unlisted(articleFiles, site.articles)
  const articleSlugs = slugsFor([...articles.map(entry => entry.file), ...strayArticles], 'article')

  for (const entry of articles) {
    const slug = articleSlugs.get(entry.file) ?? stemOf(entry.file)
    writes.set(`${articlesDir}/${entry.file}`, await migrateArticle(context, entry, slug))
    if (entry.comments) threads.push([`article=${entry.file}`, `/article/${slug}/`])
  }
  await keepAsDrafts(context, articlesDir, strayArticles, writes)

  const listed = articles.filter(entry => !entry.pinned && !entry.hidden)
  const newestFirst = listed.toSorted((a, b) => (b.created ?? 0) - (a.created ?? 0))
  if (newestFirst.some((entry, index) => entry !== listed[index])) {
    warn(context, legacyIndexPath, 'The articles were in an order of their own; bbg-next lists them newest first')
  }

  const pageFiles = await vfs.list(pagesDir)
  for (const entry of site.pages.filter(page => page.standalone)) {
    warn(
      context,
      `${pagesDir}/${entry.file}`,
      'A page of raw HTML, which bbg-next cannot show among its pages: left as it is, still at its own address',
    )
  }
  const pages = usable(
    context,
    site.pages.filter(page => !page.standalone),
    pagesDir,
    pageFiles,
  )
  const strayPages = unlisted(pageFiles, site.pages)
  const pageSlugs = slugsFor([...pages.map(entry => entry.file), ...strayPages], 'page')

  for (const entry of pages) {
    const slug = pageSlugs.get(entry.file) ?? stemOf(entry.file)
    writes.set(`${pagesDir}/${entry.file}`, await migratePage(context, entry, slug, site.pages.indexOf(entry) + 1))
    if (entry.comments) threads.push([`page=${entry.file}`, `/page/${slug}/`])
  }
  await keepAsDrafts(context, pagesDir, strayPages, writes)

  const friends = friendsPage(context, pageFiles, pageSlugs)
  if (friends !== null) {
    writes.set(`${pagesDir}/${friends.file}`, friends.content)
    if (site.friends.comments) threads.push(['internal=friendbook', `/page/${stemOf(friends.file)}/`])
  }

  return { writes, friends: friends === null ? null : stemOf(friends.file), threads, seen: context.seen }
}

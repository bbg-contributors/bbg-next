import type { RenderContext } from '../markdown.ts'
import type { Route } from '../route.ts'
import type { Vfs } from '../vfs.ts'
import type { ArticleEntry, Manifest, SiteSettings } from './schema.ts'
import type { MarkdownIt } from 'markdown-it'
import { encryptedElement } from '../content/encryption.ts'
import { stripFrontMatter } from '../content/frontmatterSplit.ts'
import { createMarkdown } from '../markdown.ts'
import { articlesDir, atomPath, sitemapPath } from '../paths.ts'
import { normaliseBase, serialize } from '../route.ts'
import { defaultExtensions } from './plugins.ts'
import { escapeHtml } from './shell.ts'

// XML 1.0 cannot carry these at all, so one in an article would break the whole feed.
const unwritable = /[^\t\n\r\u{20}-\u{D7FF}\u{E000}-\u{FFFD}\u{10000}-\u{10FFFF}]/gu

function text(value: string): string {
  return escapeHtml(value.replaceAll(unwritable, ''))
}

function element(tag: string, value: string, attributes = ''): string {
  return value === '' ? '' : `<${tag}${attributes}>${text(value)}</${tag}>\n`
}

function date(ms: number): string {
  return new Date(ms).toISOString()
}

interface Linked {
  readonly entry: ArticleEntry
  readonly link: string
}

/** `''` for what only the browser can show: a plugin's format, or an encrypted block. */
async function contentOf(vfs: Vfs, md: MarkdownIt, file: string, context: RenderContext): Promise<string> {
  if (!defaultExtensions.includes(file.slice(file.lastIndexOf('.') + 1))) return ''

  const html = md.render(stripFrontMatter(await vfs.readFile(`${articlesDir}/${file}`)), context)

  // With raw HTML off, nothing else renders as this element.
  return html.includes(`<${encryptedElement} `) ? '' : html
}

type Address = (route: Route, fragment?: string) => string

async function atom(
  vfs: Vfs,
  site: SiteSettings,
  home: string,
  articles: readonly Linked[],
  address: Address,
): Promise<string> {
  // Read away from the site, so a hash-routed one's links to another view go by their full address.
  const md = createMarkdown(site.router.mode === 'hash' ? address : undefined)
  const baseUrl = `${home}${articlesDir}/`
  const entries = await Promise.all(
    articles.map(async ({ entry, link }) => {
      const content = await contentOf(vfs, md, entry.file, { baseUrl, href: link })

      return `<entry>
<title>${text(entry.title)}</title>
<link href="${text(link)}"/>
<id>${text(link)}</id>
<published>${date(entry.created)}</published>
<updated>${date(entry.updated)}</updated>
${element('summary', entry.excerpt)}${element('content', content, ' type="html"')}</entry>
`
    }),
  )
  const updated = articles.reduce((newest, { entry }) => Math.max(newest, entry.updated), 0)

  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="${text(site.lang)}">
<title>${text(site.title)}</title>
${element('subtitle', site.description)}<link rel="self" href="${text(`${home}${atomPath}`)}"/>
<link href="${text(home)}"/>
<id>${text(home)}</id>
<updated>${date(updated)}</updated>
<author><name>${text(site.title)}</name></author>
<generator>bbg-next</generator>
${entries.join('')}</feed>
`
}

/** Each only while its switch is on, and never removed: a site may still carry the ones its previous editor wrote. */
export async function writeFeeds(vfs: Vfs, manifest: Manifest): Promise<void> {
  const { pages, site } = manifest
  const home = `${site.url}${normaliseBase(site.router.base)}`
  // The site's own routing, so a hash-routed site's addresses land on index.html rather than 404.html, which hosts answer as not found.
  const address: Address = (route, fragment) => {
    const href = serialize(route, site.router, fragment)

    return `${href.startsWith('#') ? home : site.url}${href}`
  }
  const articles = manifest.articles
    .toSorted((a, b) => b.created - a.created)
    .map(entry => ({ entry, link: address({ type: 'article', slug: entry.slug }) }))

  if (site.sitemap) {
    const links = [
      ...articles.map(({ link }) => link),
      ...pages.map(entry => address({ type: 'page', slug: entry.slug })),
      address({ type: 'archive' }),
    ]
    await vfs.writeFile(sitemapPath, links.map(link => `${link}\n`).join(''))
  }

  if (site.atom) await vfs.writeFile(atomPath, await atom(vfs, site, home, articles, address))
}

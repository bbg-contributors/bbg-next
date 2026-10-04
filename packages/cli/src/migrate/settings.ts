import type { MigratedDocuments } from './documents.ts'
import type { LegacySite } from './legacy.ts'
import type { Diagnostic, SiteSettings } from '@bbg-next/core'
import { parseSiteSettings, pluginConfigPath, themeConfigPath } from '@bbg-next/core'
import { defaultTheme } from '../assets.ts'
import { legacyIndexPath } from './legacy.ts'
import { legacySyntax } from './markdown.ts'

const officialBlue = '#0d6efd'
const hexColour = /^#[\da-f]{6}$/i
const whites = new Set(['white', '#fff', '#ffffff'])

interface MigratedSettings {
  readonly site: SiteSettings
  /** Plugin and theme configs, by path. */
  readonly writes: ReadonlyMap<string, string>
}

export function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
}

/** Scheme and host, and the path the site sits below; `null` for an address that is none. */
export function address(domain: string): { readonly url: string; readonly base: string } | null {
  let parsed: URL
  try {
    parsed = new URL(domain)
  } catch {
    return null
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null

  const segments = parsed.pathname.split('/').filter(segment => segment !== '')
  // Asked for as the site's root, which some gave with its index.html.
  if (segments.at(-1)?.includes('.') === true) segments.pop()

  return { url: parsed.origin, base: segments.length === 0 ? '/' : `/${segments.join('/')}/` }
}

/** The site's settings and the configs of what it now runs on, with a warning for all that has no counterpart. */
export function migrateSettings(
  legacy: LegacySite,
  documents: MigratedDocuments,
  diagnostics: Diagnostic[],
): MigratedSettings {
  const warn = (message: string): void => void diagnostics.push({ level: 'warn', file: legacyIndexPath, message })
  const shownAsWritten = (what: string, text: string): void => {
    const found = legacySyntax(text)
    if (found.length > 0) warn(`${what} shows as written in bbg-next: ${found.join(', ')}`)
  }

  const writes = new Map<string, string>()
  // The old theme always had its search.
  const plugins = ['legacy-routes', 'search']

  if (documents.friends !== null) {
    plugins.push('friends')
    writes.set(pluginConfigPath('legacy-routes'), json({ friends: documents.friends }))
  }

  const { announcement, comments, theme } = legacy
  if (announcement.enabled && announcement.text !== '') {
    plugins.push('announcement')
    const routes = announcement.homeOnly ? ['home'] : ['home', 'article', 'page']
    writes.set(pluginConfigPath('announcement'), json({ text: announcement.text, routes }))
    shownAsWritten('The announcement', announcement.text)
  }

  if (legacy.imageViewer) plugins.push('image-viewer')
  if (documents.seen.code) plugins.push('highlight')
  if (documents.seen.formulas) plugins.push('math')

  /** `stored` is a thread's new address as the service keeps it. */
  const commentsBy = (plugin: string, service: string, options: object, stored: (path: string) => string): void => {
    plugins.push(plugin)
    writes.set(pluginConfigPath(plugin), json(options))
    if (documents.threads.length === 0) return

    warn(
      [
        `${service} files comments under the address of the article or page they are on, and each has a new address now. Change the url of the comments in the ${service} database from each old address to its new one, or they no longer show:`,
        ...documents.threads.map(([from, to]) => `  ${from} → ${stored(to)}`),
      ].join('\n'),
    )
  }

  if (comments.waline !== '') commentsBy('waline', 'Waline', { serverURL: comments.waline }, path => path)
  // Rustaline's server drops the trailing slash.
  if (comments.rustaline !== '') {
    commentsBy('rustaline', 'Rustaline', { server: comments.rustaline }, path => path.slice(0, -1))
  }
  if (comments.valine) warn('Valine comments are not carried over: bbg-next comes with rustaline, twikoo and waline')
  if (comments.disqus) warn('Disqus comments are not carried over: bbg-next comes with rustaline, twikoo and waline')

  if (theme.wallpaper !== '') writes.set(themeConfigPath(defaultTheme), json({ wallpaper: theme.wallpaper }))
  if (theme.solidBackground !== '') {
    warn(`The solid background colour ${theme.solidBackground} is not carried over: ${defaultTheme} has none`)
  }
  const seed = hexColour.test(theme.bar) && theme.bar.toLowerCase() !== officialBlue ? theme.bar : undefined
  if (!hexColour.test(theme.bar))
    warn(`The bar colour ${theme.bar} is not a #rrggbb colour, so ${defaultTheme} uses its own`)
  if (!whites.has(theme.barText.toLowerCase()) || theme.link.toLowerCase() !== officialBlue) {
    warn(`The bar's text colour and the link colour are not carried over: ${defaultTheme} works both out from the seed`)
  }
  if (theme.thirdParty !== null) {
    warn(
      `The site used a third-party theme and now uses ${defaultTheme}. What that theme brought is left here to delete: ${theme.thirdParty.join(', ')}`,
    )
  }
  // Its config and tips come from migrateLive2d.
  if (theme.live2d !== null) plugins.push('live2d')

  if (legacy.menuLinks.length > 0) {
    warn(
      `The menu's links elsewhere (${legacy.menuLinks.join(', ')}) are not carried over: bbg-next's nav lists only the site's own pages`,
    )
  }
  if (legacy.customCode) warn('Custom CSS and JS are not carried over')
  if (legacy.customText) warn('Custom interface text is not carried over')
  if (legacy.licence) warn('The licence notice under each article is not carried over; put it in the footer to keep it')
  shownAsWritten('The footer', legacy.footer)

  const at = legacy.domain === '' ? null : address(legacy.domain)
  if (legacy.domain !== '' && at === null) {
    warn(`The site's address ${legacy.domain} is not an http(s) address, so atom.xml and sitemap.txt are left off`)
  } else if (at === null && (legacy.atom || legacy.sitemap)) {
    warn("atom.xml and sitemap.txt are left off: they need the site's address, `url` in data/site.json")
  }

  const site = parseSiteSettings({
    title: legacy.title || 'A new blog',
    description: legacy.description,
    lang: legacy.lang,
    footer: legacy.footer,
    theme: defaultTheme,
    articlesPerPage: legacy.articlesPerPage,
    router: { mode: 'hash', base: at?.base ?? '/' },
    url: at?.url ?? '',
    atom: at !== null && legacy.atom,
    sitemap: at !== null && legacy.sitemap,
    plugins,
    seed,
  })

  return { site, writes }
}

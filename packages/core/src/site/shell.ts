import type { Vfs } from '../vfs.ts'
import type { SiteSettings } from './schema.ts'
import { runtimePath } from '../paths.ts'
import { normaliseBase } from '../route.ts'

/** The element the runtime replaces on every navigation. Not part of the theme contract. */
export const outletElement = 'bbg-outlet'

const indexHtmlFile = 'index.html'
const notFoundHtmlFile = '404.html'
const nojekyllFile = '.nojekyll'

const escapes: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, char => escapes[char] ?? char)
}

// `path` needs one: the SPA fallback serves the document from /post/hello/, so relative fetches must
// still reach the site root. `hash` without one works under any subpath the author never configured.
function baseHref(site: SiteSettings): string | null {
  const base = normaliseBase(site.router.base)
  if (site.router.mode === 'path') return base

  return base === '/' ? null : base
}

function indexHtml(site: SiteSettings): string {
  const base = baseHref(site)
  const title = escapeHtml(site.title)

  return `<!doctype html>
<html lang="${escapeHtml(site.lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${base === null ? '' : `<base href="${escapeHtml(base)}">\n`}<title>${title}</title>
<meta name="description" content="${escapeHtml(site.description)}">
<script type="module" src="${runtimePath}"></script>
</head>
<body>
<${outletElement}></${outletElement}>
<noscript>
<p>${title} renders in the browser and needs JavaScript enabled.</p>
</noscript>
</body>
</html>
`
}

/**
 * Writes the machine-managed files at the site root. 404.html is the SPA fallback `path` mode needs on
 * GitHub Pages, and is deleted on the way back to `hash` so a stale copy cannot shadow a real 404.
 */
export async function writeShell(vfs: Vfs, site: SiteSettings): Promise<void> {
  const html = indexHtml(site)

  await vfs.writeFile(indexHtmlFile, html)
  await vfs.writeFile(nojekyllFile, '')

  if (site.router.mode === 'path') {
    await vfs.writeFile(notFoundHtmlFile, html)
  } else if (await vfs.exists(notFoundHtmlFile)) {
    await vfs.remove(notFoundHtmlFile)
  }
}

import type { Vfs } from '../vfs.ts'
import type { SiteSettings } from './schema.ts'
import { atomPath, runtimePath } from '../paths.ts'
import { normaliseBase } from '../route.ts'

/** The element the runtime renders into. */
export const outletElement = 'bbg-outlet'

const escapes: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, char => escapes[char] ?? char)
}

function shellHtml(site: SiteSettings, base: string | null): string {
  const title = escapeHtml(site.title)

  return `<!doctype html>
<html lang="${escapeHtml(site.lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${base === null ? '' : `<base href="${escapeHtml(base)}">\n`}<title>${title}</title>
<meta name="description" content="${escapeHtml(site.description)}">
${site.atom ? `<link rel="alternate" type="application/atom+xml" title="${title}" href="${atomPath}">\n` : ''}<script type="module" src="${runtimePath}"></script>
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

/** Writes the machine-managed files at the site root. 404.html is the site itself, which a host such as GitHub Pages shows for any path it has no file for, so a link to /post/hello/ still reaches the runtime to be routed. */
export async function writeShell(vfs: Vfs, site: SiteSettings): Promise<void> {
  // Shown from any depth, so it needs a `<base>` to reach the site root, as does `path` mode's index.html behind a host's SPA fallback. `hash` mode's index.html goes without one at `/`, which lets it work under any subpath the author never configured.
  const base = normaliseBase(site.router.base)
  const notFound = shellHtml(site, base)

  await vfs.writeFile('index.html', site.router.mode === 'hash' && base === '/' ? shellHtml(site, null) : notFound)
  await vfs.writeFile('404.html', notFound)
  await vfs.writeFile('.nojekyll', '')
}

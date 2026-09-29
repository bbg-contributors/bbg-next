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

type Icon = readonly [file: string, type: string]

// A browser takes the last icon it can show, so the sharper formats come last.
const icons: readonly Icon[] = [
  ['favicon.ico', 'image/x-icon'],
  ['favicon.png', 'image/png'],
  ['favicon.svg', 'image/svg+xml'],
]

function shellHtml(site: SiteSettings, base: string | null, found: readonly Icon[]): string {
  const title = escapeHtml(site.title)

  return `<!doctype html>
<html lang="${escapeHtml(site.lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${base === null ? '' : `<base href="${escapeHtml(base)}">\n`}<title>${title}</title>
<meta name="description" content="${escapeHtml(site.description)}">
${found.map(([file, type]) => `<link rel="icon" href="${file}" type="${type}">\n`).join('')}${site.atom ? `<link rel="alternate" type="application/atom+xml" title="${title}" href="${atomPath}">\n` : ''}<script type="module" src="${runtimePath}"></script>
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

/** Writes the machine-managed files at the site root, linking whichever favicons sit there. 404.html is the site itself, which a host such as GitHub Pages shows for any path it has no file for, so a link to /article/hello/ still reaches the runtime to be routed. */
export async function writeShell(vfs: Vfs, site: SiteSettings): Promise<void> {
  const found = (await Promise.all(icons.map(async icon => ((await vfs.exists(icon[0])) ? [icon] : [])))).flat()
  // Shown from any depth, so it needs a `<base>` to reach the site root, as does `path` mode's index.html behind a host's SPA fallback. `hash` mode's index.html goes without one at `/`, which lets it work under any subpath the author never configured.
  const base = normaliseBase(site.router.base)
  const notFound = shellHtml(site, base, found)

  await vfs.writeFile(
    'index.html',
    site.router.mode === 'hash' && base === '/' ? shellHtml(site, null, found) : notFound,
  )
  await vfs.writeFile('404.html', notFound)
  await vfs.writeFile('.nojekyll', '')
}

import type { Json, LegacySite } from './legacy.ts'
import type { Diagnostic, Vfs } from '@bbg-next/core'
import { pluginConfigPath } from '@bbg-next/core'
import en from '@bbg-next/plugin-live2d/tips/en.json' with { type: 'json' }
import ja from '@bbg-next/plugin-live2d/tips/ja.json' with { type: 'json' }
import zh from '@bbg-next/plugin-live2d/tips/zh.json' with { type: 'json' }
import { group, isObject, legacyIndexPath, list } from './legacy.ts'
import { address, json } from './settings.ts'

type Tips = typeof zh

const ownTips: Readonly<Record<LegacySite['lang'], Tips>> = { 'zh-CN': zh, en, ja }

// A scheme, or the `//` of an address that borrows the page's.
const elsewhere = /^(?:[a-z][\d+.a-z-]*:|\/\/)/i
const leadingSlashes = /^(?:\.?\/)+/

/** Where in the site the tips are, which the old theme fetched from the site root; `null` for another site. */
function inSite(tips: string, domain: string): string | null {
  const at = address(domain)
  const root = at === null ? null : `${at.url}${at.base}`
  const path = root !== null && tips.startsWith(root) ? tips.slice(root.length) : tips

  return elsewhere.test(path) ? null : path.replace(leadingSlashes, '')
}

/** bbg-next's entries, with the old tips' lines for a hand on the model, which both keep under `#live2d`. */
function withModelLines(entries: readonly Json[], old: Json, key: string): readonly Json[] {
  const text = list(old, key).find(entry => entry['selector'] === '#live2d')?.['text']

  return text === undefined
    ? entries
    : entries.map(entry => (entry['selector'] === '#live2d' ? { ...entry, text } : entry))
}

/** The old tips' own words in bbg-next's tips. Their other selectors are left behind: they were written for the old theme's pages. */
function rewrite(old: Json, base: Tips): Json {
  return {
    ...base,
    mouseover: withModelLines(base.mouseover, old, 'mouseover'),
    click: withModelLines(base.click, old, 'click'),
    seasons: old['seasons'] ?? base.seasons,
    time: old['time'] ?? base.time,
    message: { ...base.message, ...group(old, 'message') },
  }
}

/** The old tips' path in the site and their new content, `null` when bbg-next's own are used instead. */
async function rewriteTips(
  vfs: Vfs,
  legacy: LegacySite,
  tips: string,
  warn: (message: string) => void,
): Promise<readonly [path: string, content: string] | null> {
  const path = inSite(tips, legacy.domain)
  if (path === null) {
    warn(
      `The live2d tips at ${tips} are not carried over: migrate does not fetch from other sites, so bbg-next's own are used`,
    )

    return null
  }

  try {
    const old: unknown = JSON.parse(await vfs.readFile(path))
    if (!isObject(old)) throw new Error('it holds no JSON object')

    warn(
      `The live2d tips in ${path} were rewritten for bbg-next: their own words stay, their selectors, written for the old theme's pages, are dropped, and the rest is bbg-next's`,
    )

    return [path, json(rewrite(old, ownTips[legacy.lang]))]
  } catch (cause) {
    warn(`The live2d tips at ${tips} could not be read, so bbg-next's own are used: ${(cause as Error).message}`)

    return null
  }
}

/** The live2d plugin's config, and the old tips rewritten in place when they are in the site. */
export async function migrateLive2d(
  vfs: Vfs,
  legacy: LegacySite,
  diagnostics: Diagnostic[],
): Promise<ReadonlyMap<string, string>> {
  const { live2d } = legacy.theme
  if (live2d === null) return new Map()

  const warn = (message: string): void => void diagnostics.push({ level: 'warn', file: legacyIndexPath, message })
  const { widget, tips, models, tools } = live2d
  const rewritten = tips === '' ? null : await rewriteTips(vfs, legacy, tips, warn)
  if (widget !== '') warn(`The live2d widget at ${widget} is not carried over: bbg-next brings its own`)

  // An empty models path would send the widget to the site root, so it is left out, and tools always go in, as the widget shows all seven without them.
  const options = {
    ...(rewritten === null ? {} : { waifuPath: rewritten[0] }),
    ...(models === '' ? {} : { cdnPath: models }),
    tools,
  }

  return new Map([...(rewritten === null ? [] : [rewritten]), [pluginConfigPath('live2d'), json(options)]])
}

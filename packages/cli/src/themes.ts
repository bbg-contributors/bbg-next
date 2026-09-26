import type { Diagnostic, ThemeIndexEntry, ThemeMeta, Vfs } from '@bbg-next/core'
import { parseOptions, parseThemeMeta, themeConfigPath, themeMetaPath } from '@bbg-next/core'

/** A config that will not parse is reported and left out, so the theme falls back on its defaults. */
async function hasUsableConfig(vfs: Vfs, name: string, diagnostics: Diagnostic[]): Promise<boolean> {
  const path = themeConfigPath(name)
  if (!(await vfs.exists(path))) return false

  try {
    parseOptions(await vfs.readFile(path))
  } catch (cause) {
    diagnostics.push({ level: 'error', file: path, message: (cause as Error).message })

    return false
  }

  return true
}

/** What the manifest records of the theme, read back after any refresh. */
export async function loadTheme(vfs: Vfs, name: string, diagnostics: Diagnostic[]): Promise<ThemeIndexEntry> {
  const path = themeMetaPath(name)

  let meta: ThemeMeta
  try {
    meta = parseThemeMeta(JSON.parse(await vfs.readFile(path)))
  } catch (cause) {
    throw new Error(`${path} is unusable: ${(cause as Error).message}. Reinstall it with \`bbg-next theme add <dir>\`.`)
  }

  return { name: meta.name, version: meta.version, hasConfig: await hasUsableConfig(vfs, name, diagnostics) }
}

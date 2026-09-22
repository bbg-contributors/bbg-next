import type { Diagnostic, PluginIndexEntry, PluginMeta, SiteSettings, ThemeMeta, Vfs } from '@bbg-next/core'
import { access, readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  isValidSlug,
  parsePluginMeta,
  parseThemeMeta,
  pluginDir,
  pluginMetaPath,
  pluginPath,
  pluginsDir,
  runtimePath,
  themeDir,
  themeMetaPath,
  themePath,
  themesDir,
} from '@bbg-next/core'
import semver from 'semver'
import { loadPlugins } from './plugins.ts'

function distOf(packageName: string): string {
  return join(dirname(fileURLToPath(import.meta.resolve(`${packageName}/package.json`))), 'dist')
}

// every theme and plugin pins index.js as its bundle name
async function bundleIn(dir: string): Promise<string> {
  const bundle = join(dir, 'index.js')

  try {
    await access(bundle)
  } catch {
    throw new Error(`No index.js in ${dir} — build it first (\`pnpm build\` for a workspace package).`)
  }

  return bundle
}

interface Meta {
  readonly name: string
  readonly version: string
}

/** Themes and plugins are installed the same way; only these five things differ. */
interface AssetKind<M extends Meta> {
  /** Also names the metadata file, `<label>.json`. */
  readonly label: string
  readonly parse: (input: unknown) => M
  readonly bundlePath: (name: string) => string
  readonly metaPath: (name: string) => string
  /** Name -> the workspace package this CLI ships it in. */
  readonly packages: ReadonlyMap<string, string>
}

const themeKind: AssetKind<ThemeMeta> = {
  label: 'theme',
  parse: parseThemeMeta,
  bundlePath: themePath,
  metaPath: themeMetaPath,
  packages: new Map([
    ['default-theme', '@bbg-next/default-theme'],
    ['default-theme-vue', '@bbg-next/default-theme-vue'],
  ]),
}

const pluginKind: AssetKind<PluginMeta> = {
  label: 'plugin',
  parse: parsePluginMeta,
  bundlePath: pluginPath,
  metaPath: pluginMetaPath,
  packages: new Map([
    ['anchor', '@bbg-next/plugin-anchor'],
    ['hitokoto', '@bbg-next/plugin-hitokoto'],
    ['waline', '@bbg-next/plugin-waline'],
  ]),
}

/** Suggestions, not a gate: anything copied in with `theme add` is equally valid. */
export const knownThemes = [...themeKind.packages.keys()]
export const knownPlugins = [...pluginKind.packages.keys()]
export const defaultTheme = 'default-theme'

async function readBuilt<M extends Meta>(kind: AssetKind<M>, dir: string): Promise<{ bundle: string; meta: M }> {
  const bundle = await bundleIn(dir)

  let raw: string
  try {
    raw = await readFile(join(dir, `${kind.label}.json`), 'utf8')
  } catch {
    throw new Error(`No ${kind.label}.json in ${dir} — every ${kind.label} ships one beside its bundle.`)
  }

  return { bundle, meta: kind.parse(JSON.parse(raw)) }
}

/** Copying is the whole install; a site has no package.json, so there is nothing to resolve. */
async function write<M extends Meta>(kind: AssetKind<M>, vfs: Vfs, bundle: string, meta: M): Promise<void> {
  await vfs.copyIn(bundle, kind.bundlePath(meta.name))
  await vfs.writeFile(kind.metaPath(meta.name), `${JSON.stringify(meta, null, 2)}\n`)
}

/** `null` when nothing usable is installed under that name. */
async function installedVersion<M extends Meta>(kind: AssetKind<M>, vfs: Vfs, name: string): Promise<string | null> {
  if (!(await vfs.exists(kind.bundlePath(name)))) return null

  try {
    return semver.valid(kind.parse(JSON.parse(await vfs.readFile(kind.metaPath(name)))).version)
  } catch {
    return null
  }
}

/** Built-ins track the CLI, but only forward: a site may hold a build newer than this CLI ships. */
async function refresh<M extends Meta>(
  kind: AssetKind<M>,
  vfs: Vfs,
  name: string,
  packageName: string,
  diagnostics: Diagnostic[],
): Promise<string | null> {
  const { bundle, meta } = await readBuilt(kind, distOf(packageName))
  const current = await installedVersion(kind, vfs, name)

  if (current !== null && semver.gte(current, meta.version)) {
    if (semver.gt(current, meta.version)) {
      diagnostics.push({
        level: 'warn',
        file: kind.metaPath(name),
        message: `Installed ${name}@${current} is newer than the ${meta.version} this CLI ships, so it was left alone.`,
      })
    }

    return null
  }

  await write(kind, vfs, bundle, meta)

  return `${name}@${meta.version}`
}

async function syncTheme(vfs: Vfs, theme: string, diagnostics: Diagnostic[]): Promise<string | null> {
  const packageName = themeKind.packages.get(theme)
  if (packageName !== undefined) return refresh(themeKind, vfs, theme, packageName, diagnostics)

  if (!(await vfs.exists(themePath(theme)))) {
    throw new Error(
      `Unknown theme ${JSON.stringify(theme)}: ${themePath(theme)} is missing.\n` +
        `Built in: ${knownThemes.join(', ')}. For any other theme run \`bbg-next theme add <dir>\` first.`,
    )
  }

  return null
}

async function syncPlugins(vfs: Vfs, names: readonly string[], diagnostics: Diagnostic[]): Promise<string[]> {
  const updated: string[] = []

  for (const name of names) {
    const packageName = pluginKind.packages.get(name)
    if (packageName === undefined) continue

    const done = await refresh(pluginKind, vfs, name, packageName, diagnostics)
    if (done !== null) updated.push(done)
  }

  return updated
}

async function prune(vfs: Vfs, dir: string, keep: readonly string[]): Promise<void> {
  const kept = new Set(keep)
  const found = (await vfs.list(dir)).map(entry => `${dir}/${entry}`)

  await Promise.all(found.filter(item => !kept.has(item)).map(async item => vfs.remove(item)))
}

interface SyncAssetsResult {
  readonly plugins: readonly PluginIndexEntry[]
  readonly diagnostics: readonly Diagnostic[]
  readonly updated: readonly string[]
}

export async function syncAssets(vfs: Vfs, site: SiteSettings): Promise<SyncAssetsResult> {
  const diagnostics: Diagnostic[] = []

  await vfs.copyIn(await bundleIn(distOf('@bbg-next/runtime')), runtimePath)

  // Both before loadPlugins, which reads the versions they refresh.
  const refreshed = [
    await syncTheme(vfs, site.theme, diagnostics),
    ...(await syncPlugins(vfs, site.plugins, diagnostics)),
  ]
  const plugins = await loadPlugins(vfs, site.plugins, diagnostics)

  await prune(vfs, themesDir, [themeDir(site.theme)])
  // Keyed on what the site asked for: a plugin held back by a bad version stays put to be fixed.
  await prune(
    vfs,
    pluginsDir,
    site.plugins.map(name => pluginDir(name)),
  )

  return { plugins, diagnostics, updated: refreshed.filter(item => item !== null) }
}

/** `source` is a built-in name or a directory holding a built bundle. */
async function install<M extends Meta>(
  kind: AssetKind<M>,
  vfs: Vfs,
  source: string,
  override: string | undefined,
): Promise<M> {
  const packageName = kind.packages.get(source)
  const built = await readBuilt(kind, packageName === undefined ? resolve(source) : distOf(packageName))
  const meta = { ...built.meta, name: override ?? built.meta.name }

  if (!isValidSlug(meta.name)) {
    throw new Error(
      `${JSON.stringify(meta.name)} is not usable as a ${kind.label} name — pass --name with a URL-safe one.`,
    )
  }

  await write(kind, vfs, built.bundle, meta)

  return meta
}

export async function installPlugin(vfs: Vfs, source: string, override: string | undefined): Promise<PluginMeta> {
  return install(pluginKind, vfs, source, override)
}

export async function installTheme(vfs: Vfs, source: string, override: string | undefined): Promise<ThemeMeta> {
  return install(themeKind, vfs, source, override)
}

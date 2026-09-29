import type {
  Diagnostic,
  PluginIndexEntry,
  PluginMeta,
  SiteSettings,
  ThemeIndexEntry,
  ThemeMeta,
  Vfs,
} from '@bbg-next/core'
import { access, readdir, readFile, stat } from 'node:fs/promises'
import { dirname, join, relative, resolve, sep } from 'node:path'
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
  themeConfigPath,
  themeDir,
  themeMetaPath,
  themePath,
  themesDir,
} from '@bbg-next/core'
import semver from 'semver'
import { loadPlugins } from './plugins.ts'
import { loadTheme } from './themes.ts'

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
  readonly assets: readonly string[]
}

/** Themes and plugins are installed the same way; only these six things differ. */
interface AssetKind<M extends Meta> {
  /** Also names the metadata file, `<label>.json`. */
  readonly label: string
  readonly parse: (input: unknown) => M
  readonly dir: (name: string) => string
  readonly bundlePath: (name: string) => string
  readonly metaPath: (name: string) => string
  /** Name -> the workspace package this CLI ships it in. */
  readonly packages: ReadonlyMap<string, string>
}

const themeKind: AssetKind<ThemeMeta> = {
  label: 'theme',
  parse: parseThemeMeta,
  dir: themeDir,
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
  dir: pluginDir,
  bundlePath: pluginPath,
  metaPath: pluginMetaPath,
  packages: new Map([
    ['announcement', '@bbg-next/plugin-announcement'],
    ['friends', '@bbg-next/plugin-friends'],
    ['highlight', '@bbg-next/plugin-highlight'],
    ['hitokoto', '@bbg-next/plugin-hitokoto'],
    ['image-viewer', '@bbg-next/plugin-image-viewer'],
    ['legacy-routes', '@bbg-next/plugin-legacy-routes'],
    ['math', '@bbg-next/plugin-math'],
    ['twikoo', '@bbg-next/plugin-twikoo'],
    ['waline', '@bbg-next/plugin-waline'],
  ]),
}

/** Suggestions, not a gate: anything copied in with `theme add` is equally valid. */
export const knownThemes = [...themeKind.packages.keys()]
export const knownPlugins = [...pluginKind.packages.keys()]
export const defaultTheme = 'default-theme'

/** A build ready to copy in, with every file its assets hold, relative to its directory. */
interface Built<M extends Meta> {
  readonly dir: string
  readonly meta: M
  readonly files: readonly string[]
}

async function filesOf(dir: string, asset: string, label: string): Promise<string[]> {
  const path = join(dir, asset)

  let directory: boolean
  try {
    directory = (await stat(path)).isDirectory()
  } catch {
    throw new Error(`${label}.json in ${dir} lists ${asset}, which is not there — build it first?`)
  }
  if (!directory) return [asset]

  const entries = await readdir(path, { recursive: true, withFileTypes: true })

  return entries
    .filter(entry => entry.isFile())
    .map(entry => relative(dir, join(entry.parentPath, entry.name)).split(sep).join('/'))
}

async function readBuilt<M extends Meta>(kind: AssetKind<M>, dir: string): Promise<Built<M>> {
  await bundleIn(dir)

  let raw: string
  try {
    raw = await readFile(join(dir, `${kind.label}.json`), 'utf8')
  } catch {
    throw new Error(`No ${kind.label}.json in ${dir} — every ${kind.label} ships one beside its bundle.`)
  }

  const meta = kind.parse(JSON.parse(raw))
  // Gathered before anything is removed, so a build missing a file leaves the installed one working.
  const files = (await Promise.all(meta.assets.map(async asset => filesOf(dir, asset, kind.label)))).flat()

  return { dir, meta, files }
}

/** Copying is the whole install; a site has no package.json, so there is nothing to resolve. It starts from an empty directory, so nothing an earlier version brought outlives it. */
async function write<M extends Meta>(kind: AssetKind<M>, vfs: Vfs, { dir, meta, files }: Built<M>): Promise<void> {
  const target = kind.dir(meta.name)

  await vfs.remove(target)
  await vfs.copyIn(join(dir, 'index.js'), kind.bundlePath(meta.name))
  for (const file of files) await vfs.copyIn(join(dir, file), `${target}/${file}`)
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

/** Built-ins track the CLI, but only forward: a site may hold a build newer than this CLI ships. `force` overwrites it anyway. */
async function refresh<M extends Meta>(
  kind: AssetKind<M>,
  vfs: Vfs,
  name: string,
  force: boolean,
  diagnostics: Diagnostic[],
): Promise<string | null> {
  const packageName = kind.packages.get(name)
  if (packageName === undefined) return null

  const built = await readBuilt(kind, distOf(packageName))
  const { meta } = built
  const current = force ? null : await installedVersion(kind, vfs, name)

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

  await write(kind, vfs, built)

  return `${name}@${meta.version}`
}

async function prune(vfs: Vfs, dir: string, keep: readonly string[]): Promise<void> {
  const kept = new Set(keep)
  const found = (await vfs.list(dir)).map(entry => `${dir}/${entry}`)

  await Promise.all(found.filter(item => !kept.has(item)).map(async item => vfs.remove(item)))
}

interface SyncAssetsResult {
  readonly theme: ThemeIndexEntry
  readonly plugins: readonly PluginIndexEntry[]
  readonly diagnostics: readonly Diagnostic[]
  readonly updated: readonly string[]
}

export async function syncAssets(vfs: Vfs, site: SiteSettings, force: boolean): Promise<SyncAssetsResult> {
  const diagnostics: Diagnostic[] = []

  await vfs.copyIn(await bundleIn(distOf('@bbg-next/runtime')), runtimePath)

  // Both before loading, which reads the versions they refresh.
  const refreshed = [await refresh(themeKind, vfs, site.theme, force, diagnostics)]
  for (const name of site.plugins) refreshed.push(await refresh(pluginKind, vfs, name, force, diagnostics))

  if (!(await vfs.exists(themePath(site.theme)))) {
    throw new Error(
      `Unknown theme ${JSON.stringify(site.theme)}: ${themePath(site.theme)} is missing.\n` +
        `Built in: ${knownThemes.join(', ')}. For any other theme run \`bbg-next theme add <dir>\` first.`,
    )
  }
  // Laid down for the author to fill in, as `plugin add` does for a plugin, and never over one they wrote.
  const themeConfig = themeConfigPath(site.theme)
  if (!(await vfs.exists(themeConfig))) await vfs.writeFile(themeConfig, '{}\n')
  const theme = await loadTheme(vfs, site.theme, diagnostics)
  const plugins = await loadPlugins(vfs, site.plugins, diagnostics)

  await prune(vfs, themesDir, [themeDir(site.theme)])
  // Keyed on what the site asked for: a plugin held back by a bad version stays put to be fixed.
  await prune(
    vfs,
    pluginsDir,
    site.plugins.map(name => pluginDir(name)),
  )

  return { theme, plugins, diagnostics, updated: refreshed.filter(item => item !== null) }
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

  await write(kind, vfs, { ...built, meta })

  return meta
}

export async function installPlugin(vfs: Vfs, source: string, override: string | undefined): Promise<PluginMeta> {
  return install(pluginKind, vfs, source, override)
}

export async function installTheme(vfs: Vfs, source: string, override: string | undefined): Promise<ThemeMeta> {
  return install(themeKind, vfs, source, override)
}

import type { Diagnostic, PluginIndexEntry, PluginMeta, Vfs } from '@bbg-next/core'
import {
  builtinPlugins,
  defaultExtensions,
  parsePluginMeta,
  pluginConfigDir,
  pluginConfigPath,
  pluginDir,
  pluginMetaPath,
  pluginPath,
} from '@bbg-next/core'
import semver from 'semver'

/** A plugin's own metadata, paired with how the site configured it. */
interface InstalledPlugin {
  readonly meta: PluginMeta
  readonly options: Readonly<Record<string, unknown>>
  /** The runtime fetches a config only for these. */
  readonly hasConfig: boolean
}

/** Dependencies first, and within that the order the site declared: plugins layer in that order. */
function resolvePluginOrder(
  installed: readonly InstalledPlugin[],
  diagnostics: Diagnostic[],
): readonly PluginIndexEntry[] {
  const metas = installed.map(item => item.meta)
  const byName = new Map(metas.map(meta => [meta.name, meta]))
  const configured = new Set(installed.filter(item => item.hasConfig).map(item => item.meta.name))
  const rejected = new Set<string>()

  const reject = (name: string, message: string, file = pluginMetaPath(name)): void => {
    diagnostics.push({ level: 'error', file, message })
    rejected.add(name)
  }

  for (const { meta, options } of installed) {
    const missing = meta.requiredOptions.filter(key => options[key] === undefined)
    if (missing.length > 0) {
      reject(meta.name, `Plugin ${meta.name} needs these options: ${missing.join(', ')}`, pluginConfigPath(meta.name))
    }

    for (const [dependency, range] of Object.entries(meta.dependencies)) {
      const version = byName.get(dependency)?.version ?? builtinPlugins[dependency]
      if (version === undefined) {
        reject(meta.name, `Needs plugin ${JSON.stringify(dependency)}, which is not installed`)
        continue
      }
      // validRange first: satisfies() throws on a range it cannot parse.
      if (semver.validRange(range) === null || !semver.satisfies(version, range)) {
        reject(meta.name, `Needs ${dependency}@${range}, but ${dependency}@${version} is installed`)
      }
    }
  }

  // Must settle before the cycle check, or a plugin blocked by a rejected one looks like a cycle.
  for (let spreading = true; spreading;) {
    spreading = false
    for (const meta of metas) {
      if (rejected.has(meta.name)) continue

      const broken = Object.keys(meta.dependencies).find(name => rejected.has(name))
      if (broken !== undefined) {
        reject(meta.name, `Depends on ${broken}, which was rejected`)
        spreading = true
      }
    }
  }

  const ordered: PluginIndexEntry[] = []
  const placed = new Set(Object.keys(builtinPlugins))
  let pending = metas.filter(meta => !rejected.has(meta.name))

  while (pending.length > 0) {
    const ready = pending.filter(meta => Object.keys(meta.dependencies).every(name => placed.has(name)))
    if (ready.length === 0) {
      const names = pending.map(meta => meta.name)
      for (const name of names) reject(name, `Dependency cycle between: ${names.join(', ')}`)
      break
    }

    for (const meta of ready) {
      placed.add(meta.name)
      ordered.push({
        name: meta.name,
        version: meta.version,
        extensions: meta.extensions,
        dependencies: meta.dependencies,
        hasConfig: configured.has(meta.name),
      })
    }
    pending = pending.filter(meta => !placed.has(meta.name))
  }

  const claimed = new Map(defaultExtensions.map(extension => [extension, 'the built-in markdown renderer']))
  for (const entry of ordered) {
    for (const extension of entry.extensions) {
      const owner = claimed.get(extension)
      if (owner === undefined) {
        claimed.set(extension, entry.name)
        continue
      }
      diagnostics.push({
        level: 'error',
        file: pluginMetaPath(entry.name),
        message: `Claims ".${extension}", which is already rendered by ${owner}`,
      })
    }
  }

  return ordered
}

/** `null` rejects the plugin. */
async function readConfig(vfs: Vfs, meta: PluginMeta, diagnostics: Diagnostic[]): Promise<InstalledPlugin | null> {
  const path = pluginConfigPath(meta.name)
  const bare = { meta, options: {}, hasConfig: false }
  const reject = (message: string): null => {
    diagnostics.push({ level: 'error', file: path, message })

    return null
  }

  if (!(await vfs.exists(path))) return bare

  if (!meta.configurable) {
    diagnostics.push({ level: 'warn', file: path, message: `${meta.name} reads no options. Delete this file.` })

    return bare
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(await vfs.readFile(path))
  } catch (cause) {
    return reject(`Not valid JSON: ${(cause as Error).message}`)
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return reject('Must hold a JSON object of options.')
  }

  return { meta, options: parsed as Record<string, unknown>, hasConfig: true }
}

/** Read, never executed: sync must not run plugin code, and a browser bundle may not survive Node. */
async function readInstalled(
  vfs: Vfs,
  names: readonly string[],
  diagnostics: Diagnostic[],
): Promise<readonly InstalledPlugin[]> {
  const installed: InstalledPlugin[] = []

  for (const name of names) {
    const path = pluginMetaPath(name)
    const fail = (message: string): void => void diagnostics.push({ level: 'error', file: path, message })

    if (!(await vfs.exists(pluginPath(name)))) {
      fail(`${pluginPath(name)} is missing. Install it with \`bbg-next plugin add <dir>\`.`)
      continue
    }

    let meta: PluginMeta
    try {
      meta = parsePluginMeta(JSON.parse(await vfs.readFile(path)))
    } catch (cause) {
      fail((cause as Error).message)
      continue
    }

    if (meta.name !== name) {
      fail(`Declares the name ${JSON.stringify(meta.name)} but sits in ${pluginDir(name)}`)
      continue
    }

    const configured = await readConfig(vfs, meta, diagnostics)
    if (configured !== null) installed.push(configured)
  }

  return installed
}

/** Without this a typo in the filename fails silently. */
async function reportStrayConfigs(vfs: Vfs, names: readonly string[], diagnostics: Diagnostic[]): Promise<void> {
  const wanted = new Set(names.map(name => pluginConfigPath(name)))

  for (const file of await vfs.list(pluginConfigDir)) {
    const path = `${pluginConfigDir}/${file}`
    if (!file.endsWith('.json') || wanted.has(path)) continue

    diagnostics.push({ level: 'warn', file: path, message: 'No plugin of this name is enabled, so nothing reads it.' })
  }
}

export async function loadPlugins(
  vfs: Vfs,
  names: readonly string[],
  diagnostics: Diagnostic[],
): Promise<readonly PluginIndexEntry[]> {
  await reportStrayConfigs(vfs, names, diagnostics)

  return resolvePluginOrder(await readInstalled(vfs, names, diagnostics), diagnostics)
}

import type { Diagnostic } from '@bbg-next/core'
import process from 'node:process'
import { createNodeHost } from '@bbg-next/adapter/node'
import { loadSiteSettings, pluginConfigPath } from '@bbg-next/core'
import { defineCommand } from 'clerc'
import { installPlugin, knownPlugins } from '../assets.ts'
import { loadPlugins } from '../plugins.ts'
import { syncSite } from '../sync.ts'
import { reportDiagnostics, style } from '../terminal/report.ts'

export const plugin = defineCommand(
  {
    name: 'plugin',
    description: 'List the plugins this site has installed',
    parameters: ['[dir]'],
  },
  // oxlint-disable-next-line typescript/no-misused-promises -- clerc awaits the handler itself
  async ctx => {
    const { vfs } = createNodeHost(ctx.parameters.dir ?? '.')
    const site = await loadSiteSettings(vfs)

    if (site.plugins.length === 0) {
      process.stdout.write(`${style.dim('no plugins')}\n  ${style.dim('built in:')} ${knownPlugins.join(', ')}\n`)

      return
    }

    // Read from disk rather than the manifest, so the answer is current rather than last-synced.
    const diagnostics: Diagnostic[] = []
    const entries = await loadPlugins(vfs, site.plugins, diagnostics)
    const active = new Map(entries.map(entry => [entry.name, entry]))

    for (const name of site.plugins) {
      const entry = active.get(name)
      if (entry === undefined) {
        process.stdout.write(`  ${style.bold(name)} ${style.red('inactive')}\n`)
        continue
      }

      const renders =
        entry.extensions.length === 0
          ? ''
          : ` ${style.dim(`renders ${entry.extensions.map(extension => `.${extension}`).join(' ')}`)}`
      const needs =
        Object.keys(entry.dependencies).length === 0
          ? ''
          : ` ${style.dim(`needs ${Object.keys(entry.dependencies).join(', ')}`)}`
      const config = entry.hasConfig ? ` ${style.dim(pluginConfigPath(entry.name))}` : ''

      process.stdout.write(`  ${style.bold(entry.name)} ${style.dim(`v${entry.version}`)}${renders}${needs}${config}\n`)
    }

    reportDiagnostics(diagnostics)
  },
)

export const pluginAdd = defineCommand(
  {
    name: 'plugin add',
    description: 'Copy a built plugin into the site and enable it',
    parameters: ['<source>', '[dir]'],
    flags: {
      name: { type: String, description: 'Install under this name instead of the plugin’s own', default: '' },
      drafts: { type: Boolean, description: 'Include drafts', default: false },
    },
  },
  // oxlint-disable-next-line typescript/no-misused-promises -- clerc awaits the handler itself
  async ctx => {
    const { dir, source } = ctx.parameters
    const { vfs } = createNodeHost(dir ?? '.')
    const site = await loadSiteSettings(vfs)

    const meta = await installPlugin(vfs, source, ctx.flags.name === '' ? undefined : ctx.flags.name)

    // Re-adding refreshes the files, which is how a plugin gets updated.
    const already = site.plugins.includes(meta.name)
    const plugins = already ? site.plugins : [...site.plugins, meta.name]

    // Never over one the author already wrote.
    const config = pluginConfigPath(meta.name)
    const scaffolded = meta.configurable && !(await vfs.exists(config))
    if (scaffolded) await vfs.writeFile(config, '{}\n')

    const { diagnostics } = await syncSite({
      vfs,
      site: { ...site, plugins },
      includeDrafts: ctx.flags.drafts,
      force: false,
    })
    reportDiagnostics(diagnostics)

    const label = already ? 'updated' : 'added'
    process.stdout.write(`${style.green(label)} ${style.bold(meta.name)} ${style.dim(`v${meta.version}`)}\n`)

    if (meta.requiredOptions.length > 0) {
      process.stdout.write(`  ${style.dim(`set ${meta.requiredOptions.join(', ')} in ${config}`)}\n`)
    } else if (scaffolded) {
      process.stdout.write(`  ${style.dim(`configure it in ${config}`)}\n`)
    }
  },
)

export const pluginRemove = defineCommand(
  {
    name: 'plugin remove',
    description: 'Disable a plugin and drop its files',
    parameters: ['<name>', '[dir]'],
    flags: {
      drafts: { type: Boolean, description: 'Include drafts', default: false },
    },
  },
  // oxlint-disable-next-line typescript/no-misused-promises -- clerc awaits the handler itself
  async ctx => {
    const { dir, name } = ctx.parameters
    const { vfs } = createNodeHost(dir ?? '.')
    const site = await loadSiteSettings(vfs)

    if (!site.plugins.includes(name)) throw new Error(`${name} is not enabled here.`)

    // Diagnostics dropped: the sync below reports the same ones.
    const entries = await loadPlugins(vfs, site.plugins, [])
    const dependents = entries.filter(entry => Object.hasOwn(entry.dependencies, name))
    if (dependents.length > 0) {
      throw new Error(`${name} is needed by ${dependents.map(entry => entry.name).join(', ')}. Remove those first.`)
    }

    // Its config goes with it, or every later sync warns about it.
    const config = pluginConfigPath(name)
    const hadConfig = await vfs.exists(config)
    if (hadConfig) await vfs.remove(config)

    const plugins = site.plugins.filter(item => item !== name)
    const { diagnostics } = await syncSite({
      vfs,
      site: { ...site, plugins },
      includeDrafts: ctx.flags.drafts,
      force: false,
    })

    reportDiagnostics(diagnostics)
    process.stdout.write(`${style.green('removed')} ${style.bold(name)}${hadConfig ? ` ${style.dim(config)}` : ''}\n`)
  },
)

import process from 'node:process'
import { createNodeHost } from '@bbg-next/adapter/node'
import { loadSiteSettings } from '@bbg-next/core'
import { defineCommand } from 'clerc'
import { installTheme, knownThemes } from '../assets.ts'
import { syncSite } from '../sync.ts'
import { reportDiagnostics, style } from '../terminal/report.ts'

export const theme = defineCommand(
  {
    name: 'theme',
    description: 'List the available themes, marking the one in use',
    parameters: ['[dir]'],
  },
  // oxlint-disable-next-line typescript/no-misused-promises -- clerc awaits the handler itself
  async ctx => {
    const { vfs } = createNodeHost(ctx.parameters.dir ?? '.')
    const site = await loadSiteSettings(vfs)

    // The one in use may have been copied in rather than shipped.
    const names = knownThemes.includes(site.theme) ? knownThemes : [...knownThemes, site.theme]

    for (const name of names) {
      process.stdout.write(name === site.theme ? `${style.green('*')} ${style.bold(name)}\n` : `  ${name}\n`)
    }
  },
)

export const themeUse = defineCommand(
  {
    name: 'theme use',
    description: 'Switch the site to another theme',
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
    const { diagnostics } = await syncSite({
      vfs,
      site: { ...site, theme: name },
      includeDrafts: ctx.flags.drafts,
      force: false,
    })

    reportDiagnostics(diagnostics)
    process.stdout.write(
      name === site.theme
        ? `${style.green('theme')} ${style.bold(name)} ${style.dim('(unchanged)')}\n`
        : `${style.green('theme')} ${style.dim(`${site.theme} →`)} ${style.bold(name)}\n`,
    )
  },
)

export const themeAdd = defineCommand(
  {
    name: 'theme add',
    description: 'Copy a built theme into the site and switch to it',
    parameters: ['<source>', '[dir]'],
    flags: {
      name: { type: String, description: 'Install under this name instead of the directory’s', default: '' },
      drafts: { type: Boolean, description: 'Include drafts', default: false },
    },
  },
  // oxlint-disable-next-line typescript/no-misused-promises -- clerc awaits the handler itself
  async ctx => {
    const { dir, source } = ctx.parameters
    const { vfs } = createNodeHost(dir ?? '.')
    const site = await loadSiteSettings(vfs)

    const meta = await installTheme(vfs, source, ctx.flags.name === '' ? undefined : ctx.flags.name)
    const { diagnostics } = await syncSite({
      vfs,
      site: { ...site, theme: meta.name },
      includeDrafts: ctx.flags.drafts,
      force: false,
    })

    reportDiagnostics(diagnostics)
    process.stdout.write(`${style.green('theme')} ${style.bold(meta.name)} ${style.dim(`v${meta.version}`)}\n`)
  },
)

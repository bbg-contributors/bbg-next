import process from 'node:process'
import { createNodeHost } from '@bbg-next/adapter/node'
import { loadSiteSettings } from '@bbg-next/core'
import { defineCommand, Types } from 'clerc'
import { themeNames } from '../assets.ts'
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

    for (const name of themeNames) {
      process.stdout.write(name === site.theme ? `${style.green('*')} ${style.bold(name)}\n` : `  ${name}\n`)
    }
  },
)

export const themeUse = defineCommand(
  {
    name: 'theme use',
    description: 'Switch the site to another theme',
    parameters: [{ key: '<name>', type: Types.Enum(...themeNames) }, '[dir]'],
    flags: {
      drafts: { type: Boolean, description: 'Include drafts', default: false },
    },
  },
  // oxlint-disable-next-line typescript/no-misused-promises -- clerc awaits the handler itself
  async ctx => {
    const { dir, name } = ctx.parameters
    const { vfs } = createNodeHost(dir ?? '.')
    const site = await loadSiteSettings(vfs)
    const { diagnostics } = await syncSite({ vfs, site: { ...site, theme: name }, includeDrafts: ctx.flags.drafts })

    reportDiagnostics(diagnostics)
    process.stdout.write(
      name === site.theme
        ? `${style.green('theme')} ${style.bold(name)} ${style.dim('(unchanged)')}\n`
        : `${style.green('theme')} ${style.dim(`${site.theme} →`)} ${style.bold(name)}\n`,
    )
  },
)

import process from 'node:process'
import { createNodeHost } from '@bbg-next/adapter/node'
import { loadSiteSettings } from '@bbg-next/core'
import { defineCommand } from 'clerc'
import { syncSite } from '../sync.ts'
import { reportDiagnostics, style } from '../terminal/report.ts'

export const sync = defineCommand(
  {
    name: 'sync',
    description: 'Regenerate the manifest, the HTML shell and the bundled assets',
    parameters: ['[dir]'],
    flags: {
      drafts: { type: Boolean, description: 'Include drafts', default: false },
    },
  },
  // oxlint-disable-next-line typescript/no-misused-promises -- clerc awaits the handler itself
  async ctx => {
    const { dir } = ctx.parameters
    const { drafts } = ctx.flags

    const { root, vfs } = createNodeHost(dir ?? '.')
    const site = await loadSiteSettings(vfs)
    const { diagnostics } = await syncSite({ vfs, site, includeDrafts: drafts })

    reportDiagnostics(diagnostics)
    process.stdout.write(`${style.green('synced')} ${root} ${style.dim(`theme ${site.theme}`)}\n`)
  },
)

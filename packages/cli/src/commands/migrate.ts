import process from 'node:process'
import { createNodeHost } from '@bbg-next/adapter/node'
import { manifestPath } from '@bbg-next/core'
import { defineCommand } from 'clerc'
import { migrateSite } from '../migrate/index.ts'
import { legacyIndexPath } from '../migrate/legacy.ts'
import { syncSite } from '../sync.ts'
import { reportDiagnostics, style } from '../terminal/report.ts'
import { withPasswordPrompt } from '../terminal/tty.ts'

export const migrate = defineCommand(
  {
    name: 'migrate',
    description: 'Turn a site made by the old bbg editor into a bbg-next site, in place',
    parameters: ['[dir]'],
  },
  // oxlint-disable-next-line typescript/no-misused-promises -- clerc awaits the handler itself
  async ctx => {
    const { dir } = ctx.parameters
    const { root, vfs } = createNodeHost(dir ?? '.')

    if (await vfs.exists(manifestPath)) throw new Error(`${root} is a bbg-next site already.`)
    if (!(await vfs.exists(legacyIndexPath))) {
      throw new Error(`No ${legacyIndexPath} here — is this a site made by the old bbg editor?`)
    }

    const migrated = await withPasswordPrompt(async ask => migrateSite(vfs, ask))
    const { diagnostics } = await syncSite({ vfs, site: migrated.site, includeDrafts: false })
    reportDiagnostics([...migrated.diagnostics, ...diagnostics])

    process.stdout.write(`${style.green('migrated')} ${root}\n  ${style.dim('next:')} bbg-next preview ${dir ?? '.'}\n`)
  },
)

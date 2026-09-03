import process from 'node:process'
import { createNodeHost } from '@bbg-next/adapter/node'
import { dataDir, loadSiteSettings, manifestFile, manifestPath } from '@bbg-next/core'
import { defineCommand } from 'clerc'
import { getPort } from 'get-port-please'
import { startPreviewServer } from '../server.ts'
import { syncSite } from '../sync.ts'
import { reportDiagnostics, style } from '../terminal/report.ts'
import { interactive, onQuit } from '../terminal/tty.ts'

/** Coalesces the burst of events a single editor save produces. */
function debounce(delay: number, action: () => void): () => void {
  let timer: NodeJS.Timeout | undefined

  return () => {
    if (timer !== undefined) clearTimeout(timer)
    timer = setTimeout(action, delay)
  }
}

export const preview = defineCommand(
  {
    name: 'preview',
    description: 'Serve the site locally with live reload',
    parameters: ['[dir]'],
    flags: {
      port: { type: Number, description: 'Port to listen on (default: first free from 4321)' },
      host: { type: String, description: 'Host to bind', default: 'localhost' },
      open: { type: Boolean, description: 'Open the site in a browser', default: false },
      drafts: { type: Boolean, description: 'Include drafts', default: false },
      sync: {
        type: Boolean,
        description: 'Regenerate the site on every change; --no-sync leaves that to `bbg-next sync`',
        default: true,
      },
    },
  },
  // oxlint-disable-next-line typescript/no-misused-promises -- clerc awaits the handler itself
  async ctx => {
    const { dir } = ctx.parameters
    const { drafts, host: hostname, open, port: requestedPort, sync: autoSync } = ctx.flags

    const host = createNodeHost(dir ?? '.')
    const { vfs } = host

    // Our own write must not loop the watcher.
    let lastWritten = ''

    // `--no-sync` still reads the site, so a missing or broken one is reported rather than served as 404s.
    const rebuild = async (): Promise<void> => {
      const site = await loadSiteSettings(vfs)
      if (!autoSync) return

      const { diagnostics, manifest } = await syncSite({ vfs, site, includeDrafts: drafts })
      lastWritten = manifest

      reportDiagnostics(diagnostics)
    }

    await rebuild()

    const port = await getPort(
      requestedPort === undefined
        ? { host: hostname, port: 4321, portRange: [4321, 4400] }
        : { host: hostname, port: requestedPort },
    )
    const server = await startPreviewServer({ root: host.root, host: hostname, port })

    const refresh = debounce(60, () => {
      void rebuild()
        .then(() => server.reload())
        .catch((cause: unknown) => {
          // keep serving: a syntax error in site.json shouldn't kill preview
          process.stderr.write(`${style.red('error')} ${(cause as Error).message}\n`)
        })
    })

    // Just `data` — overlapping watch roots would deliver every change twice.
    const stopWatching = await host.watch([dataDir], path => {
      if (!path.endsWith(manifestFile)) {
        refresh()

        return
      }
      // ours or theirs?
      void vfs
        .readFile(manifestPath)
        .then(content => {
          if (content !== lastWritten) refresh()
        })
        .catch(() => refresh())
    })

    // Armed before the URL is printed, or a keypress in between is still handled by the cooked tty.
    // Settling rather than process.exit lets Node exit once the last handles are released.
    const quit = new Promise<void>(settle => {
      onQuit(() => {
        void Promise.all([stopWatching(), server.close()]).finally(() => {
          settle()
        })
      })
    })

    const draftsNote = drafts ? 'drafts included' : 'drafts hidden — pass --drafts to include them'

    process.stdout.write(
      `${style.green('preview')} ${style.bold(server.url)}\n` +
        `  ${style.dim('serving')} ${host.root}\n` +
        `  ${style.dim(autoSync ? draftsNote : 'not syncing — `bbg-next sync` owns the generated files')}\n` +
        `  ${style.dim(interactive ? 'press q to quit' : 'send SIGINT to quit')}\n`,
    )

    if (open) host.openExternal(server.url)

    await quit
  },
)

import type { Host } from '../index.ts'
import { spawn } from 'node:child_process'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { watch as chokidarWatch } from 'chokidar'
import { createNodeVfs } from './vfs.ts'

function browserCommand(url: string): { command: string; args: string[] } {
  if (process.platform === 'darwin') return { command: 'open', args: [url] }
  // `start` is a cmd builtin; the empty string is the (required) window title.
  if (process.platform === 'win32') return { command: 'cmd', args: ['/c', 'start', '', url] }

  return { command: 'xdg-open', args: [url] }
}

export function createNodeHost(root: string): Host {
  const absoluteRoot = resolve(root)

  return {
    root: absoluteRoot,
    vfs: createNodeVfs(absoluteRoot),

    watch: async (dirs, onChange) => {
      const watcher = chokidarWatch(
        dirs.map(dir => join(absoluteRoot, dir)),
        {
          ignoreInitial: true,
          // editors write in several syscalls; without this we read half-written files
          awaitWriteFinish: { stabilityThreshold: 80, pollInterval: 20 },
        },
      )

      watcher.on('all', (_event, path) => onChange(path))
      await new Promise<void>((settle, fail) => {
        watcher.once('ready', settle)
        watcher.once('error', fail)
      })

      return async () => {
        await watcher.close()
      }
    },

    // Arguments as an array, never interpolated into a shell string.
    openExternal: url => {
      const { command, args } = browserCommand(url)
      const child = spawn(command, args, { stdio: 'ignore', detached: true })
      // an unhandled 'error' would throw, and a missing opener is not worth failing on
      child.once('error', () => {})
      child.unref()
    },
  }
}

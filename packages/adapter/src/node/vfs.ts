import type { Vfs } from '@bbg-next/core'
import { constants } from 'node:fs'
import { access, copyFile, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'

/** Refuses to escape the root, so a crafted slug cannot reach arbitrary files. */
function resolveWithin(root: string, path: string): string {
  const absolute = resolve(root, path)
  const rel = relative(root, absolute)
  if (rel.startsWith(`..${sep}`) || rel === '..' || isAbsolute(rel)) {
    throw new Error(`Path escapes the site root: ${path}`)
  }

  return absolute
}

export function createNodeVfs(root: string): Vfs {
  const at = (path: string): string => resolveWithin(root, path)

  return {
    readFile: async path => readFile(at(path), 'utf8'),

    writeFile: async (path, content) => {
      const target = at(path)
      await mkdir(dirname(target), { recursive: true })
      await writeFile(target, content, 'utf8')
    },

    exists: async path => {
      try {
        await access(at(path), constants.F_OK)

        return true
      } catch {
        return false
      }
    },

    // a missing directory just means no articles yet
    list: async dir => {
      try {
        return await readdir(at(dir))
      } catch (cause) {
        if ((cause as NodeJS.ErrnoException).code === 'ENOENT') return []
        throw cause
      }
    },

    remove: async path => {
      await rm(at(path), { force: true, recursive: true })
    },

    copyIn: async (hostPath, path) => {
      const target = at(path)
      await mkdir(dirname(target), { recursive: true })
      await copyFile(hostPath, target)
    },
  }
}

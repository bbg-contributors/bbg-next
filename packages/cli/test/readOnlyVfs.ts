import type { Vfs } from '@bbg-next/core'

/** Only reads: loading what is installed must never write. */
export function readOnlyVfs(files: Readonly<Record<string, string>>): Vfs {
  const unused = (): never => {
    throw new Error('loading must not write')
  }

  return {
    exists: async path => Object.hasOwn(files, path),

    readFile: async path => {
      const content = files[path]
      if (content === undefined) throw new Error(`ENOENT: ${path}`)

      return content
    },

    list: async dir =>
      Object.keys(files)
        .filter(path => path.startsWith(`${dir}/`))
        .map(path => path.slice(dir.length + 1)),

    writeFile: unused,
    remove: unused,
    copyIn: unused,
  }
}

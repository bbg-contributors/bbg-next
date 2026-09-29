import type { Vfs } from '../src/vfs.ts'

/** In-memory `Vfs`, so domain logic never touches a real filesystem. */
export function createMemoryVfs(initial: Readonly<Record<string, string>> = {}): Vfs {
  const files = new Map(Object.entries(initial))

  return {
    readFile: async path => {
      const content = files.get(path)
      if (content === undefined) throw new Error(`ENOENT: ${path}`)

      return content
    },

    writeFile: async (path, content) => {
      files.set(path, content)
    },

    exists: async path => files.has(path),

    list: async dir => {
      const prefix = `${dir}/`
      const names = new Set<string>()
      for (const path of files.keys()) {
        if (!path.startsWith(prefix)) continue
        const rest = path.slice(prefix.length)
        const slash = rest.indexOf('/')
        names.add(slash === -1 ? rest : rest.slice(0, slash))
      }

      return [...names]
    },

    remove: async path => {
      for (const key of [...files.keys()]) {
        if (key === path || key.startsWith(`${path}/`)) files.delete(key)
      }
    },

    copyIn: async (hostPath, path) => {
      files.set(path, `<copied from ${hostPath}>`)
    },
  }
}

/** Every side effect core has. Paths are POSIX and site-relative. */
export interface Vfs {
  readFile: (path: string) => Promise<string>
  writeFile: (path: string, content: string) => Promise<void>
  exists: (path: string) => Promise<boolean>
  /** Immediate children only. A missing dir yields `[]`. */
  list: (dir: string) => Promise<string[]>
  remove: (path: string) => Promise<void>
  /** `hostPath` is absolute and outside the site. */
  copyIn: (hostPath: string, path: string) => Promise<void>
}

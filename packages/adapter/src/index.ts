import type { Vfs } from '@bbg-next/core'

/** Everything a frontend needs from the platform. */
export interface Host {
  readonly vfs: Vfs
  /** Absolute site root. */
  readonly root: string
  /** Resolves to a function that stops watching. */
  readonly watch: (dirs: readonly string[], onChange: (path: string) => void) => Promise<() => Promise<void>>
  /** Best-effort: the browser is detached, so there is nothing to await. */
  readonly openExternal: (url: string) => void
}

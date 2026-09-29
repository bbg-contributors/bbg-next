import type { Diagnostic, SiteSettings, Vfs } from '@bbg-next/core'
import { writeSite } from '@bbg-next/core'
import { syncAssets } from './assets.ts'

interface SyncOptions {
  readonly vfs: Vfs
  readonly site: SiteSettings
  readonly includeDrafts: boolean
  /** Rewrite the built-in themes and plugins whatever version is installed. */
  readonly force?: boolean
}

interface SyncResult {
  readonly diagnostics: readonly Diagnostic[]
  /** What was written to the manifest, so a watcher can tell this write from a hand edit. */
  readonly manifest: string
  /** Built-in themes and plugins written from what this CLI ships, as `name@version`. */
  readonly updated: readonly string[]
}

/** The one writer of generated files. Bundles first, so an unusable theme fails before the rest is written. */
export async function syncSite(options: SyncOptions): Promise<SyncResult> {
  const { force = false, includeDrafts, site, vfs } = options
  const { diagnostics, theme, plugins, updated } = await syncAssets(vfs, site, force)
  const written = await writeSite(vfs, { site, includeDrafts, theme, plugins })

  return { diagnostics: [...diagnostics, ...written.diagnostics], manifest: written.manifest, updated }
}

import type { Diagnostic, SiteSettings, Vfs } from '@bbg-next/core'
import { buildManifest, manifestPath, serializeManifest, writeShell } from '@bbg-next/core'
import { syncAssets } from './assets.ts'

export interface SyncOptions {
  readonly vfs: Vfs
  readonly site: SiteSettings
  readonly includeDrafts: boolean
  /** Rewrite the built-in themes and plugins whatever version is installed. */
  readonly force: boolean
}

export interface SyncResult {
  readonly diagnostics: readonly Diagnostic[]
  /** What was written, so a watcher can tell this write from a hand edit. */
  readonly manifest: string
  /** Built-in themes and plugins written from what this CLI ships, as `name@version`. */
  readonly updated: readonly string[]
}

/** The one writer of generated files. Assets first: an unusable theme fails before anything is written. */
export async function syncSite(options: SyncOptions): Promise<SyncResult> {
  const { force, includeDrafts, site, vfs } = options

  const { diagnostics: assetDiagnostics, theme, plugins, updated } = await syncAssets(vfs, site, force)

  const { diagnostics, manifest } = await buildManifest({ vfs, site, includeDrafts, theme, plugins })
  const serialized = serializeManifest(manifest)

  await vfs.writeFile(manifestPath, serialized)
  await writeShell(vfs, site)

  return { diagnostics: [...assetDiagnostics, ...diagnostics], manifest: serialized, updated }
}

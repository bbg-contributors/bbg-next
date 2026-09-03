import type { Diagnostic, SiteSettings, Vfs } from '@bbg-next/core'
import { buildManifest, manifestPath, serializeManifest, writeShell } from '@bbg-next/core'
import { syncAssets } from './assets.ts'

export interface SyncOptions {
  readonly vfs: Vfs
  readonly site: SiteSettings
  readonly includeDrafts: boolean
}

export interface SyncResult {
  readonly diagnostics: readonly Diagnostic[]
  /** What was written, so a watcher can tell this write from a hand edit. */
  readonly manifest: string
}

/** The one writer of generated files. Assets first: an unusable theme fails before anything is written. */
export async function syncSite(options: SyncOptions): Promise<SyncResult> {
  const { includeDrafts, site, vfs } = options

  await syncAssets(vfs, site.theme)

  const { diagnostics, manifest } = await buildManifest({ vfs, site, includeDrafts })
  const serialized = serializeManifest(manifest)

  await vfs.writeFile(manifestPath, serialized)
  await writeShell(vfs, site)

  return { diagnostics, manifest: serialized }
}

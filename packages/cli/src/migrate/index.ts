import type { AskPassword } from '../terminal/tty.ts'
import type { Diagnostic, SiteSettings, Vfs } from '@bbg-next/core'
import { migrateDocuments } from './documents.ts'
import { legacyIndexPath, readLegacySite } from './legacy.ts'
import { migrateSettings } from './settings.ts'

interface MigrateResult {
  readonly site: SiteSettings
  readonly diagnostics: readonly Diagnostic[]
}

/** Turns the old editor's site into a bbg-next one in place, leaving the generated files to sync. Everything is worked out, and every password asked, before the first write. */
export async function migrateSite(vfs: Vfs, ask: AskPassword): Promise<MigrateResult> {
  const legacy = await readLegacySite(vfs)
  const diagnostics: Diagnostic[] = []
  const documents = await migrateDocuments(vfs, legacy, ask, diagnostics)
  const { site, writes } = migrateSettings(legacy, documents, diagnostics)

  for (const [path, content] of [...documents.writes, ...writes]) await vfs.writeFile(path, content)
  await vfs.remove(legacyIndexPath)

  return { site, diagnostics }
}

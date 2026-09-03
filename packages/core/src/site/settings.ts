import type { Vfs } from '../vfs.ts'
import type { SiteSettings } from './schema.ts'
import * as v from 'valibot'
import { manifestPath } from '../paths.ts'
import { SiteSettingsSchema } from './schema.ts'

// named so the CLI prints `SiteError: …`
class SiteError extends Error {
  override name = 'SiteError'
}

/** So hosts never need valibot themselves. */
export function parseSiteSettings(input: unknown): SiteSettings {
  const result = v.safeParse(SiteSettingsSchema, input)
  if (!result.success) throw new SiteError(`Invalid site settings: ${result.issues[0].message}`)

  return result.output
}

/** Only the hand-maintained `site` half; the rest is always rebuilt from front matter. */
export async function loadSiteSettings(vfs: Vfs): Promise<SiteSettings> {
  if (!(await vfs.exists(manifestPath))) {
    throw new SiteError(`No ${manifestPath} here — is this a bbg-next site? Run \`bbg-next init\` first.`)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(await vfs.readFile(manifestPath))
  } catch (cause) {
    throw new SiteError(`${manifestPath} is not valid JSON: ${(cause as Error).message}`)
  }

  try {
    return parseSiteSettings((parsed as { site?: unknown } | null)?.site)
  } catch (cause) {
    throw new SiteError(`In ${manifestPath}: ${(cause as Error).message}`)
  }
}

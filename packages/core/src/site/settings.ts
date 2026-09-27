import type { Vfs } from '../vfs.ts'
import type { PluginMeta, SiteSettings, ThemeMeta } from './schema.ts'
import * as v from 'valibot'
import { manifestPath } from '../paths.ts'
import { PluginMetaSchema, SiteSettingsSchema, ThemeMetaSchema } from './schema.ts'

function parse<Schema extends v.GenericSchema>(schema: Schema, input: unknown, what: string): v.InferOutput<Schema> {
  const result = v.safeParse(schema, input)
  if (!result.success) throw new Error(`Invalid ${what}: ${result.issues[0].message}`)

  return result.output
}

/** So hosts never need valibot themselves. */
export function parseSiteSettings(input: unknown): SiteSettings {
  return parse(SiteSettingsSchema, input, 'site settings')
}

export function parsePluginMeta(input: unknown): PluginMeta {
  return parse(PluginMetaSchema, input, 'plugin.json')
}

export function parseThemeMeta(input: unknown): ThemeMeta {
  return parse(ThemeMetaSchema, input, 'theme.json')
}

/** A theme's or a plugin's config: any JSON object, left for its reader to validate. */
export function parseOptions(text: string): Readonly<Record<string, unknown>> {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (cause) {
    throw new Error(`Not valid JSON: ${(cause as Error).message}`)
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Must hold a JSON object of options.')
  }

  return parsed as Readonly<Record<string, unknown>>
}

/** Only the hand-maintained `site` half; the rest is always rebuilt from front matter. */
export async function loadSiteSettings(vfs: Vfs): Promise<SiteSettings> {
  if (!(await vfs.exists(manifestPath))) {
    throw new Error(`No ${manifestPath} here — is this a bbg-next site? Run \`bbg-next init\` first.`)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(await vfs.readFile(manifestPath))
  } catch (cause) {
    throw new Error(`${manifestPath} is not valid JSON: ${(cause as Error).message}`)
  }

  try {
    return parseSiteSettings((parsed as { site?: unknown } | null)?.site)
  } catch (cause) {
    throw new Error(`In ${manifestPath}: ${(cause as Error).message}`)
  }
}

import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'
import { FrontMatterError, splitFrontMatter } from './frontmatterSplit.ts'

/** Every key survives, not just the ones `meta.ts` knows. */
export interface FrontMatterDocument {
  readonly data: Record<string, unknown>
  readonly body: string
}

const leadingNewlines = /^\n+/

export function parseFrontMatter(source: string): FrontMatterDocument {
  const split = splitFrontMatter(source)
  if (split.yaml === null) return { data: {}, body: split.body }

  let parsed: unknown
  try {
    parsed = parseYaml(split.yaml)
  } catch (cause) {
    throw new FrontMatterError(`Invalid YAML in front matter: ${(cause as Error).message}`)
  }

  if (parsed === null || parsed === undefined) return { data: {}, body: split.body }
  if (typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new FrontMatterError('Front matter must be a YAML mapping')
  }

  return { data: parsed as Record<string, unknown>, body: split.body }
}

export function stringifyFrontMatter(data: Record<string, unknown>, body: string): string {
  if (Object.keys(data).length === 0) return body

  const yamlText = stringifyYaml(data, { lineWidth: 0 }).trimEnd()

  return `---\n${yamlText}\n---\n\n${body.replace(leadingNewlines, '')}`
}

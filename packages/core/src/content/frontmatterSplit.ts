// Separate from frontmatter.ts: yaml is not tree-shaken, and merging costs the runtime bundle 30 kB.

const openDelimiter = /^---[ \t]*\r?\n/
const closeDelimiter = /^---[ \t]*$/m
const trailingNewline = /\r?\n$/
const leadingBlankLines = /^(?:\r?\n)+/

export class FrontMatterError extends Error {
  override name = 'FrontMatterError'
}

export interface FrontMatterSplit {
  /** Raw YAML text, or `null` when the document has no front matter. */
  readonly yaml: string | null
  readonly body: string
}

export function splitFrontMatter(source: string): FrontMatterSplit {
  const text = source.startsWith('﻿') ? source.slice(1) : source

  const open = openDelimiter.exec(text)
  if (open === null) return { yaml: null, body: text }

  const rest = text.slice(open[0].length)
  const close = closeDelimiter.exec(rest)
  if (close === null) throw new FrontMatterError('Front matter opened with `---` but never closed')

  return {
    // `$` under /m stops before the newline, so both sides have to drop it themselves.
    yaml: rest.slice(0, close.index).replace(trailingNewline, ''),
    body: rest.slice(close.index + close[0].length).replace(leadingBlankLines, ''),
  }
}

export function stripFrontMatter(source: string): string {
  return splitFrontMatter(source).body
}

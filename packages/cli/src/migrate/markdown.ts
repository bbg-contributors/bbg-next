// Markdown written for the old theme. Code, fenced or inline, is left as it is and never read.

const fenceOpen = /^ {0,3}(`{3,}|~{3,})/
const codeSpan = /(?<!`)(`+)(?!`)[\s\S]+?(?<!`)\1(?!`)/g
const spanMark = /\uE000(\d+)\uE001/g
const foundMark = /\uE002(\d+)\uE003/g

/** Runs `map` over everything but code, with code spans stood in for by marks it must leave alone. */
function mapProse(body: string, map: (prose: string) => string): string {
  const out: string[] = []
  let prose: string[] = []
  let close: RegExp | null = null

  const flush = (): void => {
    if (prose.length === 0) return

    const spans: string[] = []
    const masked = prose.join('\n').replace(codeSpan, span => `\uE000${spans.push(span) - 1}\uE001`)
    out.push(map(masked).replace(spanMark, (_, index: string) => spans[Number(index)] ?? ''))
    prose = []
  }

  for (const line of body.split('\n')) {
    if (close !== null) {
      out.push(line)
      if (close.test(line)) close = null
      continue
    }

    const marker = fenceOpen.exec(line)?.[1]
    if (marker === undefined) {
      prose.push(line)
      continue
    }

    flush()
    out.push(line)
    close = new RegExp(`^ {0,3}${marker[0] === '`' ? '`' : '~'}{${marker.length},}[ \\t\\r]*$`)
  }
  flush()

  return out.join('\n')
}

/** Every match of `pattern` outside code, swapped in turn for what `replace` makes of it and its first group. */
export async function replaceOutsideCode(
  body: string,
  pattern: RegExp,
  replace: (match: string, group: string) => Promise<string>,
): Promise<string> {
  const found: (readonly [string, string])[] = []
  const marked = mapProse(body, prose =>
    prose.replace(pattern, (match: string, group: string) => `\uE002${found.push([match, group]) - 1}\uE003`),
  )

  const replaced: string[] = []
  for (const [match, group] of found) replaced.push(await replace(match, group))

  return marked.replace(foundMark, (_, index: string) => replaced[Number(index)] ?? '')
}

// `[text](target` and `![alt](target`, the text holding brackets one deep as a linked image's does.
const inlineLink = /(!?)(\[(?:\\.|[^\\[\]]|\[(?:\\.|[^\\[\]])*\])*\]\(\s*)(<[^>\n]*>|[^\s)]+)/g
const absolute = /^(?:[a-z][a-z\d+.-]*:|[/#?])/i

/** The old theme resolved relative links from the site root, and images too unless `images` sat beside the document, where bbg-next resolves both from. */
export function rebaseLinks(body: string, images: boolean): string {
  return mapProse(body, prose =>
    prose.replace(inlineLink, (link: string, bang: string, head: string, target: string) => {
      if (bang === '!' && images) return link

      const angled = target.startsWith('<')
      const bare = angled ? target.slice(1, -1) : target
      if (bare === '' || absolute.test(bare)) return link

      return `${bang}${head}${angled ? `<../../${bare}>` : `../../${bare}`}`
    }),
  )
}

const hint = /<(?:info|warning|success|danger)-hint\b/i
const ref = /<ref\b/i
// As the math plugin reads them: a `$` hard against the formula at either end, and no digit after the last, so a price is none.
const formula = /\$\$[\s\S]+?\$\$|\$[^\s$](?:[^$\n]*[^\s$])?\$(?!\d)/
const tag = /<\/?([a-z][\w-]*)(?=[\s/>])[^>]*>/gi
const htmlComment = /<!--[\s\S]*?-->/
// Their own warnings say what became of them.
const accounted = /-hint$|^ref$|^partial_encrypted$/

/** Everything but code, code spans left out. */
function proseOf(text: string): string {
  const runs: string[] = []
  mapProse(text, prose => {
    runs.push(prose.replace(spanMark, ''))

    return prose
  })

  return runs.join('\n')
}

/** What in `text` was written for the old theme and shows as written in bbg-next. */
export function legacySyntax(text: string): readonly string[] {
  const prose = proseOf(text)
  const tags = new Set(
    [...prose.matchAll(tag)].map(match => (match[1] ?? '').toLowerCase()).filter(name => !accounted.test(name)),
  )
  if (htmlComment.test(prose)) tags.add('!--')

  return [
    ...(hint.test(prose) ? ['hint boxes'] : []),
    ...(ref.test(prose) ? ['<ref>'] : []),
    ...(tags.size > 0 ? [`HTML (${[...tags].map(name => `<${name}>`).join(', ')})`] : []),
  ]
}

export function hasFormulas(text: string): boolean {
  return formula.test(proseOf(text))
}

export function hasCodeBlocks(text: string): boolean {
  return text.split('\n').some(line => fenceOpen.test(line))
}

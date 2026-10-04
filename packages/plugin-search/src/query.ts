const blanks = /\s+/gu
const special = /[$()*+.?[\\\]^{|}]/gu

const lead = 20
const tail = 50

export interface Query {
  /** One per word, each taken literally whatever its case: a match holds them all. */
  readonly words: readonly RegExp[]
  /** Any of the words, captured, so splitting on it leaves the hits at the odd indices. */
  readonly any: RegExp
}

/** `null` for nothing but space. */
export function parseQuery(input: string): Query | null {
  const words = input
    .split(blanks)
    .filter(word => word !== '')
    .map(word => word.replaceAll(special, '\\$&'))
  if (words.length === 0) return null

  return {
    words: words.map(word => new RegExp(word, 'iu')),
    // Longest first, so a word inside another one is not what gets marked.
    any: new RegExp(`(${words.toSorted((a, b) => b.length - a.length).join('|')})`, 'iu'),
  }
}

export function holds(query: Query, text: string): boolean {
  return query.words.every(word => word.test(text))
}

/** Built of nodes rather than markup, so nothing in `text` is ever read as HTML. */
export function mark(text: string, query: Query): Node[] {
  return text.split(query.any).map((part, index) => {
    if (index % 2 === 0) return document.createTextNode(part)

    const hit = document.createElement('mark')
    hit.textContent = part

    return hit
  })
}

/** A line's worth of `text` round the hit at `at`: a little before it, the rest after. */
export function around(text: string, at: number): string {
  const start = Math.max(0, at - lead)
  const end = at + tail

  return `${start > 0 ? '…' : ''}${text.slice(start, end).replaceAll(blanks, ' ').trim()}${end < text.length ? '…' : ''}`
}

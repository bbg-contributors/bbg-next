// Fallback for articles with no `excerpt` in front matter.
const maxLength = 160

const skipLine = /^(?:#{1,6}\s|[><|]|[-*+]\s|\d+[.)]\s|:{3})/
const lineBreak = /\r?\n/
const fence = /^(?:```|~~~)/

const image = /!\[[^\]]*\]\([^)]*\)/g
const link = /\[([^\]]*)\]\([^)]*\)/g
const codeSpan = /`([^`]*)`/g
const emphasis = /[*_~]{1,3}([^*_~]+)[*_~]{1,3}/g
const whitespaceRun = /\s+/g

function stripInline(text: string): string {
  return text
    .replace(image, '')
    .replace(link, '$1')
    .replace(codeSpan, '$1')
    .replace(emphasis, '$1')
    .replace(whitespaceRun, ' ')
    .trim()
}

export function deriveExcerpt(body: string): string {
  let inFence = false
  const paragraph: string[] = []

  for (const rawLine of body.split(lineBreak)) {
    const line = rawLine.trim()

    if (fence.test(line)) {
      inFence = !inFence
      continue
    }
    if (inFence) continue

    if (line === '' || skipLine.test(line)) {
      if (paragraph.length > 0) break

      continue
    }

    paragraph.push(line)
  }

  const text = stripInline(paragraph.join(' '))
  if (text.length <= maxLength) return text

  // CJK has no spaces to break on, hence the hard cut.
  const cut = text.slice(0, maxLength)
  const lastSpace = cut.lastIndexOf(' ')

  return `${(lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
}

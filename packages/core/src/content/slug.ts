// No transliteration: CJK stays verbatim, percent-encoded at link time.

// `-._~` are absent on purpose — unreserved in URLs.
const unsafeChars = /[\p{Cc}/\\?#[\]@!$&'()*+,;=:%"<>|^`{}]/gu
const whitespace = /\s+/g
const hyphenRun = /-{2,}/g
// no leading dot: that is a hidden file
const edgeJunk = /^[.-]+|[.-]+$/g

export function slugify(input: string): string {
  return input
    .normalize('NFC')
    .trim()
    .replace(whitespace, '-')
    .replace(unsafeChars, '')
    .replace(hyphenRun, '-')
    .replace(edgeJunk, '')
}

export function slugFromFilename(filename: string, extensions: readonly string[]): string {
  for (const extension of extensions) {
    const suffix = `.${extension}`
    if (filename.endsWith(suffix)) return filename.slice(0, -suffix.length)
  }

  return filename
}

export function isValidSlug(slug: string): boolean {
  return slug !== '' && slug === slugify(slug)
}

import hljs from 'highlight.js/lib/common'

const languageClass = /\blanguage-(\S+)/

/** By the fence's language, or by a guess where it names none, as the original theme guessed for every block. A language highlight.js does not know is left as written. */
export function colour(code: HTMLElement): void {
  const text = code.textContent ?? ''
  const language = languageClass.exec(code.className)?.[1]
  if (language !== undefined && hljs.getLanguage(language) === undefined) return

  code.innerHTML =
    language === undefined
      ? hljs.highlightAuto(text).value
      : hljs.highlight(text, { language, ignoreIllegals: true }).value
}

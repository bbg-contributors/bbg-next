import type { Labels } from './labels.ts'

export function formatDate(epochMs: number, month: Labels['month']): string {
  const lang = document.documentElement.lang

  // Spelt out rather than dateStyle, which ignores the month style once hour12 is asked for.
  return new Intl.DateTimeFormat(lang === '' ? undefined : lang, {
    year: 'numeric',
    month,
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(epochMs)
}

/** One stable hue per tag, rather than a fixed colour, so tags stay legible in either scheme. */
export function tagColor(name: string): string {
  let hash = 0
  for (let index = 0; index < name.length; index += 1) hash = (hash * 31 + name.charCodeAt(index)) | 0

  return `hsl(${230 + (Math.abs(hash) % 100)} 68% var(--tag-lightness))`
}

import type { Labels } from '../labels.ts'
import type { ArticleCard, TagLink } from '@bbg-next/view'
import type { IconNode } from 'lucide'
import { Calendar, Clock, Tags } from 'lucide'
import { el, icon, link } from './base.ts'

type Dated = Pick<ArticleCard, 'created' | 'updated' | 'tags'>

function formatDate(epochMs: number, month: Labels['month']): string {
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

/** Dotted underneath as the original's cards had them, but plain in its archive. */
function stamp(node: IconNode, label: string, epochMs: number, t: Labels, dotted: boolean): HTMLElement | null {
  if (epochMs === 0) return null

  const iso = new Date(epochMs).toISOString()
  const time = el('time', dotted ? 'border-b border-dashed border-dash' : undefined, formatDate(epochMs, t.month))
  time.dateTime = iso
  time.title = iso

  const stamped = el('span')
  stamped.append(icon(node), ` ${label} `, time)

  return stamped
}

/** When it was written, then when it was last touched; either may be missing, and an article carrying neither gets nothing. */
export function stamps(card: Dated, t: Labels, dotted = true): HTMLElement[] {
  return [stamp(Calendar, t.created, card.created, t, dotted), stamp(Clock, t.updated, card.updated, t, dotted)].filter(
    part => part !== null,
  )
}

/** One stable hue per tag, rather than a fixed colour, so tags stay legible in either scheme. */
export function tagColor(name: string): string {
  let hash = 0
  for (let index = 0; index < name.length; index += 1) hash = (hash * 31 + name.charCodeAt(index)) | 0

  return `hsl(${230 + (Math.abs(hash) % 100)} 68% var(--tag-lightness))`
}

function tagsRow(tags: readonly TagLink[], t: Labels): HTMLElement {
  const row = el('div', 'mt-1.5')
  row.append(icon(Tags), ` ${t.tags}`)

  for (const tag of tags) {
    const anchor = link(tag.href, `#${tag.name}`, 'ml-2 underline decoration-1 [text-underline-position:under]')
    anchor.style.color = tagColor(tag.name)
    row.append(anchor)
  }

  return row
}

/** The date and tag lines shared by the list and the article banner. */
export function metaRow(card: Dated, t: Labels): HTMLElement {
  const meta = el('div', 'text-muted')

  const [first, second] = stamps(card, t)
  if (first !== undefined) {
    const dates = el('div')
    dates.append(first)
    if (second !== undefined) dates.append(' ', el('span', 'mx-1', '|'), ' ', second)
    meta.append(dates)
  }

  if (card.tags.length > 0) meta.append(tagsRow(card.tags, t))

  return meta
}

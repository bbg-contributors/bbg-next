import type { Labels } from '@bbg-next/default-theme-shared'
import type { ArticleCard, TagLink } from '@bbg-next/view'
import type { IconNode } from 'lucide'
import { formatDate, tagColor } from '@bbg-next/default-theme-shared'
import { Calendar, Clock, Tags } from 'lucide'
import { el, icon, link } from './base.ts'

type Dated = Pick<ArticleCard, 'created' | 'updated' | 'tags'>

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

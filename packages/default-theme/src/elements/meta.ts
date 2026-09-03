import type { ArticleCard } from '@bbg-next/view'
import { el } from './base.ts'

function formatDate(epochMs: number): string {
  if (epochMs === 0) return ''
  const locale = document.documentElement.lang === '' ? undefined : document.documentElement.lang

  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(epochMs))
}

/** The pin/date/tags row shared by the list and the article view. */
export function metaRow(card: Pick<ArticleCard, 'created' | 'tags' | 'pinned'>): HTMLElement {
  const meta = el('div', 'bbg-meta')
  if (card.pinned) meta.append(el('span', 'bbg-pin', 'Pinned'))

  const date = formatDate(card.created)
  if (date !== '') meta.append(el('time', undefined, date))

  for (const tag of card.tags) meta.append(el('span', 'bbg-tag', `#${tag}`))

  return meta
}

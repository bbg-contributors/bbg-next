import type { Labels } from '@bbg-next/default-theme-shared'
import type { ArticleCard } from '@bbg-next/view'
import type { LucideIcon } from '@lucide/vue'
import { Calendar, Clock } from '@lucide/vue'

export function stamps(
  card: Pick<ArticleCard, 'created' | 'updated'>,
  t: Labels,
): { icon: LucideIcon; label: string; at: number }[] {
  return [
    { icon: Calendar, label: t.created, at: card.created },
    { icon: Clock, label: t.updated, at: card.updated },
  ].filter(stamp => stamp.at !== 0)
}

import type { ArticleCard } from '@bbg-next/view'

/** In the order the articles come, newest first, so the liveliest group leads. */
export function group<Key>(
  articles: readonly ArticleCard[],
  keys: (card: ArticleCard) => readonly Key[],
): Map<Key, ArticleCard[]> {
  const groups = new Map<Key, ArticleCard[]>()
  for (const card of articles) {
    for (const key of keys(card)) {
      const cards = groups.get(key)
      if (cards === undefined) groups.set(key, [card])
      else cards.push(card)
    }
  }

  return groups
}

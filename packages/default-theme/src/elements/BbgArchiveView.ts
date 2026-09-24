import type { Labels } from '../labels.ts'
import type { ArchiveModel, ArticleCard } from '@bbg-next/view'
import type { IconNode } from 'lucide'
import { Calendar, FileText, Tags } from 'lucide'
import { labels } from '../labels.ts'
import { el, icon, link, ModelElement } from './base.ts'
import { banner, enter, main, panel, retitle } from './layout.ts'
import { stamps, tagColor } from './meta.ts'

/** In the order the articles come, newest first, so the liveliest group leads. */
function group<Key>(
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

function coloured(name: string): HTMLElement {
  const tag = el('span', undefined, `#${name}`)
  tag.style.color = tagColor(name)

  return tag
}

function heading(tag: 'h2' | 'h3', node: IconNode, title: string | Node): HTMLElement {
  const text = el(tag, `mb-2 leading-[1.2] font-medium ${tag === 'h2' ? 'fs-2' : 'fs-3'}`)
  text.append(icon(node), ' ', title)

  return text
}

function entry(card: ArticleCard, t: Labels): HTMLElement {
  const line = el('p', 'mb-4')
  line.append(icon(FileText), ' ', link(card.href, card.title, 'text-accent underline hover:text-accent-hover'))

  const [first, second] = stamps(card, t, false)
  if (first !== undefined) {
    const [open, separator, close] = t.aside
    line.append(open, first)
    if (second !== undefined) line.append(separator, second)
    line.append(close)
  }

  return line
}

function byTag(articles: readonly ArticleCard[], t: Labels): Node[] {
  const tagged = group(articles, card => card.tags.map(tag => tag.name))
  const nodes = [...tagged].flatMap(([name, cards]) => [
    heading('h2', Tags, coloured(name)),
    ...cards.map(card => entry(card, t)),
  ])

  const untagged = articles.filter(card => card.tags.length === 0)
  if (untagged.length > 0) nodes.push(heading('h3', Tags, t.untagged), ...untagged.map(card => entry(card, t)))

  return nodes
}

function byYear(articles: readonly ArticleCard[], t: Labels): Node[] {
  const years = group(articles, card => [new Date(card.created).getFullYear()])

  return [...years].flatMap(([year, cards]) => [
    heading('h2', Calendar, String(year)),
    ...cards.map(card => entry(card, t)),
  ])
}

// Selection eases in, as the nav's mark does: snapping to it would cut off the ripple of the press that made it.
const tabClass =
  'ripple -mb-px cursor-pointer rounded-t-[.25rem] border border-transparent px-4 py-2 text-accent transition-colors duration-300 hover:text-accent-hover aria-selected:cursor-default aria-selected:border-line aria-selected:border-b-page aria-selected:bg-surface aria-selected:text-fg'

/** Bootstrap's tabs, as the original drew them, with the first open to begin with. */
function tabs(choices: readonly (readonly [label: string, content: Node[]])[]): Node[] {
  const panels = choices.map(([, content]) => {
    const box = panel(...content)
    box.setAttribute('role', 'tabpanel')

    return box
  })

  const buttons = choices.map(([label]) => {
    const button = el('button', tabClass, label)
    button.type = 'button'
    button.setAttribute('role', 'tab')

    return button
  })

  const select = (index: number): void => {
    for (const [other, button] of buttons.entries()) button.setAttribute('aria-selected', String(other === index))
    for (const [other, box] of panels.entries()) box.hidden = other !== index
  }

  for (const [index, button] of buttons.entries()) button.addEventListener('click', () => select(index))
  select(0)

  const list = el('div', 'mt-12 flex flex-wrap border-b border-line')
  list.setAttribute('role', 'tablist')
  list.append(...buttons)

  return [list, ...panels]
}

function taggedTitle(tag: string, t: Labels): HTMLElement {
  const [before, after] = t.tagged
  const title = el('span')

  title.append(icon(Tags), ' ')
  if (before !== '') title.append(`${before} `)
  title.append(coloured(tag))
  if (after !== '') title.append(` ${after}`)

  return title
}

export class BbgArchiveView extends ModelElement<ArchiveModel> {
  readonly #banner = banner()
  readonly #main = main()

  protected override build(): void {
    this.append(this.#banner, this.#main)
  }

  protected override update(model: ArchiveModel): void {
    const t = labels()
    if (this.changed('title', model.tag)) {
      retitle(this.#banner, model.tag === null ? t.archive : taggedTitle(model.tag, t))
    }

    if (this.changed('articles', model)) {
      this.#main.replaceChildren(
        ...(model.tag === null
          ? tabs([
              [t.byTag, byTag(model.articles, t)],
              [t.byYear, byYear(model.articles, t)],
            ])
          : [panel(...model.articles.map(card => entry(card, t)))]),
      )
      enter(this.#main)
    }
  }
}

import { definePlugin, injectStyle, readString, wordFor } from '@bbg-next/plugin'
import css from './style.css?inline'

// A page lists its friends in a `bbg-friends` fence: `key: value` lines, a blank line between one friend and the next.

type Fields = Readonly<Record<string, unknown>>

interface Friend {
  readonly name: string
  readonly url: string
  readonly avatar: string | null
  readonly description: string
}

const blankLine = /\n[ \t]*\n/

function blocks(source: string): Fields[] {
  return source.split(blankLine).flatMap(block => {
    const fields: Record<string, string> = {}
    for (const line of block.split('\n')) {
      const colon = line.indexOf(':')
      if (colon !== -1) fields[line.slice(0, colon).trim()] = line.slice(colon + 1).trim()
    }

    return Object.keys(fields).length === 0 ? [] : [fields]
  })
}

/** An http(s) address or nothing: `javascript:` above all must not become a link. */
function webAddress(value: string, base: URL): string | null {
  if (value === '') return null

  try {
    const url = new URL(value, base)

    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null
  } catch {
    return null
  }
}

function friend(fields: Fields, base: URL): Friend | null {
  const name = readString(fields, 'name', '')
  const url = webAddress(readString(fields, 'url', ''), base)
  if (name === '' || url === null) return null

  return {
    name,
    url,
    avatar: webAddress(readString(fields, 'avatar', ''), base),
    description: readString(fields, 'description', ''),
  }
}

function span(className: string, text: string): HTMLSpanElement {
  const node = document.createElement('span')
  node.className = className
  node.textContent = text

  return node
}

function card({ name, url, avatar, description }: Friend): HTMLAnchorElement {
  const link = document.createElement('a')
  link.className = 'bbg-friend'
  link.href = url
  link.target = '_blank'
  link.rel = 'noopener'
  if (description !== '') link.title = description

  // The first letter stands in for a missing or broken avatar.
  const initial = span('bbg-friend-avatar', [...name][0] ?? '')

  if (avatar === null) {
    link.append(initial)
  } else {
    const image = document.createElement('img')
    image.className = 'bbg-friend-avatar'
    image.src = avatar
    image.alt = ''
    image.loading = 'lazy'
    image.decoding = 'async'
    image.addEventListener('error', () => void image.replaceWith(initial), { once: true })
    link.append(image)
  }

  link.append(span('bbg-friend-name', name))
  if (description !== '') link.append(span('bbg-friend-description', description))

  return link
}

/** A JSON array of friends, with the same keys a block has, and addresses relative to the file itself. */
async function fetchFriends(source: string): Promise<Friend[]> {
  const response = await fetch(source)
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${source}`)

  const list: unknown = await response.json()
  if (!Array.isArray(list)) throw new TypeError(`${source} does not hold a JSON array`)

  return list.flatMap((item: unknown) => {
    const found = typeof item === 'object' && item !== null ? friend(item as Fields, new URL(source)) : null

    return found === null ? [] : [found]
  })
}

/** Only turning it off is remembered, since on is where every visitor starts. */
const shuffleKey = 'bbg-friends-shuffle'

function shuffling(): boolean {
  try {
    return localStorage.getItem(shuffleKey) !== 'off'
  } catch {
    return true
  }
}

function remember(on: boolean): void {
  try {
    if (on) localStorage.removeItem(shuffleKey)
    else localStorage.setItem(shuffleKey, 'off')
  } catch {
    // Storage refused: the choice holds for this page only.
  }
}

class BbgFriends extends HTMLElement {
  #drawn = false

  connectedCallback(): void {
    if (this.#drawn) return
    this.#drawn = true

    const base = new URL(this.getAttribute('data-base') ?? '', document.baseURI)
    let shuffled = shuffling()

    // Each written block's cards, in the order written; a source's fill in once it arrives.
    const slots: HTMLAnchorElement[][] = []
    // Drawn once per card, so friends arriving later slot into the shuffle without moving the rest.
    const lots = new WeakMap<HTMLElement, number>()

    const list = document.createElement('div')
    list.className = 'bbg-friends-list'

    const toggle = document.createElement('button')
    toggle.type = 'button'
    toggle.className = 'bbg-friends-shuffle'
    toggle.setAttribute('role', 'switch')
    toggle.append(wordFor(document.documentElement.lang, { zh: '随机排列', ja: 'ランダムに並べる' }, 'Shuffle'))
    toggle.append(span('bbg-friends-track', ''))

    const draw = (): void => {
      const cards = slots.flat()
      if (shuffled) cards.sort((a, b) => (lots.get(a) ?? 0) - (lots.get(b) ?? 0))

      toggle.setAttribute('aria-checked', String(shuffled))
      toggle.hidden = cards.length < 2
      list.replaceChildren(...cards)
    }

    const make = (found: Friend): HTMLAnchorElement => {
      const made = card(found)
      lots.set(made, Math.random())

      return made
    }

    toggle.addEventListener('click', () => {
      shuffled = !shuffled
      remember(shuffled)
      draw()
    })

    for (const fields of blocks(this.getAttribute('data-source') ?? '')) {
      const slot: HTMLAnchorElement[] = []
      slots.push(slot)

      const source = webAddress(readString(fields, 'source', ''), base)
      if (source === null) {
        const found = friend(fields, base)
        if (found !== null) slot.push(make(found))
        continue
      }

      fetchFriends(source).then(
        friends => {
          slot.push(...friends.map(make))
          draw()
        },
        (cause: unknown) => void console.error(`bbg-next: cannot load friends from ${source}`, cause),
      )
    }

    this.replaceChildren(toggle, list)
    draw()
  }
}

export const setup = definePlugin(() => {
  injectStyle('bbg-plugin-friends', css)
  if (customElements.get('bbg-friends') === undefined) customElements.define('bbg-friends', BbgFriends)
})

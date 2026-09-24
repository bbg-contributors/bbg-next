// Where a render leaves the reader. Back and forward render after the browser would have restored the position, so the runtime keeps each history entry's position itself, under a key in the entry's state.

/** Once every picture in `element` has loaded or failed, or a second has gone by. */
async function pictures(element: HTMLElement): Promise<void> {
  const loading = [...element.querySelectorAll('img')]
    .filter(image => !image.complete)
    .map(async image => image.decode().catch(() => {}))

  await Promise.race([Promise.all(loading), new Promise(resolve => void setTimeout(resolve, 1000))])
}

/** No fragment, or one naming nothing, means the top. */
export function reveal(fragment: string, behavior: ScrollBehavior): void {
  const target = fragment === '' ? null : document.getElementById(fragment)
  if (target === null) scrollTo({ top: 0, behavior })
  else target.scrollIntoView({ behavior })
}

/** Pictures still loading can leave the page too short to get there, so once they are in it tries again, unless the reader has moved on. */
export function scrollBack(top: number, element: HTMLElement): void {
  scrollTo({ top, behavior: 'instant' })
  const reached = scrollY

  void pictures(element).then(() => {
    if (element.isConnected && scrollY === reached) scrollTo({ top, behavior: 'instant' })
  })
}

export interface Visits {
  /** The state for a new entry, remembering where the one on screen was left. */
  readonly next: () => { readonly entry: string }
  /** Takes up the entry `state` names, marking one the runtime never made, and gives back where that entry was left. */
  readonly resume: (state: unknown) => number | undefined
  /** Gives the browser its scroll restoration back. */
  readonly teardown: () => void
}

/** The key the runtime gave a history entry, or `null` for one it never made, like an address-bar edit. */
function entryOf(state: unknown): string | null {
  return typeof state === 'object' && state !== null && 'entry' in state && typeof state.entry === 'string'
    ? state.entry
    : null
}

export function createVisits(): Visits {
  const restoration = history.scrollRestoration
  history.scrollRestoration = 'manual'

  const positions = new Map<string, number>()
  // Random per load: an entry's state outlives a reload, the positions do not.
  const session = Math.random().toString(36).slice(2)
  let made = 0
  let current = ''

  const mark = (): string => (current = `${session}.${(made += 1)}`)
  const leave = (): void => {
    if (current !== '') positions.set(current, scrollY)
  }

  return {
    next: () => {
      leave()

      return { entry: mark() }
    },

    resume: state => {
      leave()

      // One the runtime never made is marked now, so coming back to it later finds its place too.
      const known = entryOf(state)
      if (known === null) history.replaceState({ entry: mark() }, '')
      else current = known

      return positions.get(current)
    },

    teardown: () => void (history.scrollRestoration = restoration),
  }
}

import { el } from './elements/base.ts'

// Matched as the stylesheet matches them: the theme's own controls by the `ripple` utility, the runtime's and plugins' buttons by `bbg-button`.
const controls = '.ripple, .bbg-button'

/** A wave spreading from where the pointer went down to the control's middle. What it returns lets the wave go. */
function wave(control: HTMLElement, { clientX, clientY }: PointerEvent): () => Promise<void> {
  const { left, top, width, height } = control.getBoundingClientRect()
  const x = clientX - left
  const y = clientY - top
  const diameter = Math.max(Math.hypot(width, height), 48)

  // Over the whole control, border and corners included, where the control's own overflow would clip inside its border.
  const surface = el('span', 'pointer-events-none absolute overflow-hidden rounded-[inherit] motion-reduce:hidden')
  Object.assign(surface.style, {
    top: `${-control.clientTop}px`,
    left: `${-control.clientLeft}px`,
    width: `${width}px`,
    height: `${height}px`,
  })

  const node = el('span', 'absolute rounded-full bg-current/12')
  Object.assign(node.style, {
    left: `${x - diameter / 2}px`,
    top: `${y - diameter / 2}px`,
    width: `${diameter}px`,
    height: `${diameter}px`,
  })
  surface.append(node)
  control.prepend(surface)

  const spread = node.animate(
    { translate: ['0 0', `${width / 2 - x}px ${height / 2 - y}px`], scale: [0.4, 1] },
    { duration: 225, easing: 'cubic-bezier(0.2, 0, 0, 1)', fill: 'forwards' },
  )
  node.animate({ opacity: [0, 1] }, 75)

  return async () => {
    await spread.finished
    await node.animate({ opacity: [1, 0] }, { duration: 150, fill: 'forwards' }).finished
    surface.remove()
  }
}

function press(event: PointerEvent): void {
  if (event.button !== 0 || !(event.target instanceof Element)) return

  const control = event.target.closest<HTMLElement>(controls)
  if (control === null || control.matches(':disabled')) return

  const release = wave(control, event)
  const held = new AbortController()
  const letGo = (): void => {
    held.abort()
    void release()
  }
  for (const type of ['pointerup', 'pointerleave', 'pointercancel'] as const) {
    control.addEventListener(type, letGo, { signal: held.signal })
  }
}

/** MDUI's ripple. Listening on the document reaches controls drawn later and the runtime's own; adding the same listener twice adds nothing. */
export function ripples(): void {
  document.addEventListener('pointerdown', press)
}

// @vitest-environment happy-dom
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { ripples } from '../src/ripple.ts'

beforeAll(() => ripples())

function press(target: Element, button = 0): void {
  target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button, clientX: 10, clientY: 10 }))
}

function waves(control: Element): number {
  return control.querySelectorAll(':scope > span').length
}

describe('a ripple', () => {
  it('spreads from a press of the main button, on the controls that ripple', () => {
    document.body.innerHTML = '<button class="ripple"><b>Press</b></button><button>Plain</button>'
    const rippling = document.querySelector('.ripple') as HTMLButtonElement
    const plain = document.querySelector('button:not(.ripple)') as HTMLButtonElement
    const label = document.querySelector('b') as Element

    press(label, 2)
    press(label)
    press(plain)

    expect([waves(rippling), waves(plain)]).toEqual([1, 0])
  })

  it('reaches the buttons the runtime and plugins draw, unless one is busy', () => {
    document.body.innerHTML =
      '<bbg-encrypted><form><input><button class="bbg-button">Unlock</button></form></bbg-encrypted>'
    const unlock = document.querySelector('button') as HTMLButtonElement

    press(unlock)
    unlock.disabled = true
    press(unlock)

    expect(waves(unlock)).toBe(1)
  })

  it('fades once let go, leaving the control as it was', async () => {
    document.body.innerHTML = '<button class="ripple">Press</button>'
    const button = document.querySelector('button') as HTMLButtonElement

    press(button)
    button.dispatchEvent(new PointerEvent('pointerup'))

    await vi.waitFor(() => expect(button.innerHTML).toBe('Press'))
  })
})

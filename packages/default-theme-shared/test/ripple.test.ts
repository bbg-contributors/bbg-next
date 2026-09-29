// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { ripples } from '../src/ripple.ts'

describe('a ripple', () => {
  it('reaches the buttons the runtime and plugins draw, unless one is busy', () => {
    ripples()
    document.body.innerHTML =
      '<bbg-encrypted><form><input><button class="bbg-button">Unlock</button></form></bbg-encrypted>'
    const unlock = document.querySelector('button') as HTMLButtonElement
    const press = (): void =>
      void unlock.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: 10, clientY: 10 }))

    press()
    unlock.disabled = true
    press()

    expect(unlock.querySelectorAll(':scope > span')).toHaveLength(1)
  })
})

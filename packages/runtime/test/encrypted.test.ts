// @vitest-environment happy-dom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { defineEncrypted } from '../src/encrypted.ts'
import { wordingFor } from '../src/wording.ts'

// `Hello *there*.` behind `hunter2`
const payload =
  'v1.600000.2169ea373d81964b14107468f18f331b.702e4ebf37f00834e2188879.acbb1e677e890d8b88845e2abe9b7419f89d822d96ef4c0b77846b28413538'

function place(source: string): HTMLElement {
  const block = document.createElement('bbg-encrypted')
  block.setAttribute('data-source', source)
  document.body.replaceChildren(block)

  return block
}

function submit(block: HTMLElement, password: string): void {
  const input = block.querySelector('input')
  if (input === null) throw new Error('no password field')

  input.value = password
  block.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }))
}

describe('an encrypted block', () => {
  beforeAll(() => void defineEncrypted({ render: markdown => `<p>${markdown.trim()}</p>`, words: wordingFor('en') }))

  afterEach(() => void vi.restoreAllMocks())

  it('opens into whatever the page renders the markdown as', async () => {
    const block = place(payload)
    submit(block, 'hunter2')

    await vi.waitFor(() => expect(block.innerHTML).toBe('<p>Hello *there*.</p>'))
  })

  it('says so when the password is wrong, and lets the reader try again', async () => {
    const block = place(payload)
    submit(block, 'hunter3')

    await vi.waitFor(() =>
      expect(block.querySelector('.bbg-encrypted-error')?.textContent).toBe('Wrong password, try again.'),
    )
    expect(block.querySelector('button')?.disabled).toBe(false)
  })

  it('gives up on a damaged block instead of asking forever', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const block = place('v1.damaged')
    submit(block, 'hunter2')

    await vi.waitFor(() => expect(block.querySelector('input')?.disabled).toBe(true))
    expect(block.querySelector('.bbg-encrypted-error')?.textContent).toBe('This encrypted content is damaged.')
  })
})

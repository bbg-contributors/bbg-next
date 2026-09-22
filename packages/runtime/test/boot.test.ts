// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { start } from '../src/boot.ts'
import { stubFetchWithProbe } from '../testing/index.ts'
import * as stubTheme from './stubTheme.ts'

describe('startup failure', () => {
  afterEach(() => void vi.unstubAllGlobals())

  it('reports it instead of leaving a blank page', async () => {
    vi.stubGlobal('fetch', async () => new Response('nope', { status: 500 }))
    document.body.innerHTML = '<bbg-outlet></bbg-outlet>'

    await expect(start(async () => stubTheme)).rejects.toThrow(/500/)
  })

  it('reports a missing outlet', async () => {
    document.body.innerHTML = ''

    await expect(start(async () => stubTheme)).rejects.toThrow(/bbg-outlet/)
  })
})

describe('startup in parallel', () => {
  let teardown: (() => void) | undefined

  beforeEach(() => {
    stubFetchWithProbe()
    document.body.innerHTML = '<bbg-outlet></bbg-outlet>'
  })

  afterEach(() => {
    teardown?.()
    teardown = undefined
    vi.unstubAllGlobals()
  })

  it('has the theme downloading by the time a plugin sets up', async () => {
    const seen: boolean[] = []
    let asked = false

    teardown = await start(
      async () => {
        asked = true

        return stubTheme
      },
      async () => ({ setup: () => void seen.push(asked) }),
    )

    expect(seen).toEqual([true])
  })
})

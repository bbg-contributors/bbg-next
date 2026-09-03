// @vitest-environment happy-dom
import * as defaultTheme from '@bbg-next/default-theme'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { start } from '../src/boot.ts'
import { describeThemeContract, stubFetch } from './themeContract.ts'

describeThemeContract(defaultTheme)

describe('startup failure', () => {
  beforeEach(stubFetch)

  it('reports it instead of leaving a blank page', async () => {
    vi.stubGlobal('fetch', async () => new Response('nope', { status: 500 }))
    document.body.innerHTML = '<bbg-outlet></bbg-outlet>'

    await expect(start(async () => defaultTheme)).rejects.toThrow(/500/)
  })

  it('reports a missing outlet', async () => {
    document.body.innerHTML = ''

    await expect(start(async () => defaultTheme)).rejects.toThrow(/bbg-outlet/)
  })
})

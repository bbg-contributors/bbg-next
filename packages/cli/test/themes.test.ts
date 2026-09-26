import type { Diagnostic } from '@bbg-next/core'
import { themeConfigPath, themeMetaPath } from '@bbg-next/core'
import { describe, expect, it } from 'vitest'
import { loadTheme } from '../src/themes.ts'
import { readOnlyVfs } from './readOnlyVfs.ts'

const installed = { [themeMetaPath('default-theme')]: JSON.stringify({ name: 'default-theme', version: '0.1.0' }) }

/** Loads the installed theme as sync does, beside `config` as its config file if given. */
async function load(config?: string) {
  const files = config === undefined ? installed : { ...installed, [themeConfigPath('default-theme')]: config }
  const diagnostics: Diagnostic[] = []
  const entry = await loadTheme(readOnlyVfs(files), 'default-theme', diagnostics)

  return { entry, diagnostics }
}

describe('config file', () => {
  it('is marked for the runtime to fetch when the theme has one', async () => {
    const { entry, diagnostics } = await load('{ "wallpaper": "background.webp" }')

    expect(entry).toEqual({ name: 'default-theme', version: '0.1.0', hasConfig: true })
    expect(diagnostics).toEqual([])
  })

  it('is not asked for when the theme has none', async () => {
    const { entry, diagnostics } = await load()

    expect(entry.hasConfig).toBe(false)
    expect(diagnostics).toEqual([])
  })

  it('is dropped with the reason when it holds no object of options, leaving the theme on its defaults', async () => {
    const { entry, diagnostics } = await load('["wallpaper"]')

    expect(entry.hasConfig).toBe(false)
    expect(diagnostics[0]).toMatchObject({ level: 'error', file: 'data/themes/default-theme.json' })
    expect(diagnostics[0]?.message).toMatch(/JSON object/)
  })
})

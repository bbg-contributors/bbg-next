import type { Diagnostic } from '@bbg-next/core'
import { themeConfigPath, themeMetaPath } from '@bbg-next/core'
import { createMemoryVfs } from '@bbg-next/core/testing'
import { describe, expect, it } from 'vitest'
import { loadTheme } from '../src/themes.ts'

describe('a theme’s config file', () => {
  it('is dropped with the reason when it holds no object of options, leaving the theme on its defaults', async () => {
    const files = {
      [themeMetaPath('default-theme')]: JSON.stringify({ name: 'default-theme', version: '0.1.0' }),
      [themeConfigPath('default-theme')]: '["wallpaper"]',
    }
    const diagnostics: Diagnostic[] = []
    const entry = await loadTheme(createMemoryVfs(files), 'default-theme', diagnostics)

    expect(entry.hasConfig).toBe(false)
    expect(diagnostics[0]).toMatchObject({ level: 'error', file: 'data/themes/default-theme.json' })
    expect(diagnostics[0]?.message).toMatch(/JSON object/)
  })
})

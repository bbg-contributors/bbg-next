import type { RouterConfig } from '../src/route.ts'
import * as v from 'valibot'
import { describe, expect, it } from 'vitest'
import { writeSite } from '../src/site/manifest.ts'
import { SiteSettingsSchema } from '../src/site/schema.ts'
import { createMemoryVfs } from '../testing/index.ts'

async function shell(
  router: RouterConfig,
  files: Readonly<Record<string, string>> = {},
): Promise<{ index: string; notFound: string }> {
  const vfs = createMemoryVfs(files)
  const site = v.parse(SiteSettingsSchema, { title: 'Test blog', router })
  await writeSite(vfs, {
    site,
    includeDrafts: false,
    theme: { name: 'default-theme', version: '1.2.3', hasConfig: false },
    plugins: [],
  })

  return { index: await vfs.readFile('index.html'), notFound: await vfs.readFile('404.html') }
}

describe('404.html', () => {
  it('is index.html itself once the site needs a base: in path mode, or below the root', async () => {
    for (const router of [
      { mode: 'path', base: '/blog/' },
      { mode: 'hash', base: '/blog/' },
    ] as const) {
      const { index, notFound } = await shell(router)

      expect(notFound).toBe(index)
      expect(index).toContain('<base href="/blog/">')
    }
  })

  it('finds the site root from any depth in hash mode, where index.html at the root goes without a base', async () => {
    const { index, notFound } = await shell({ mode: 'hash', base: '/' })

    expect(index).not.toContain('<base')
    expect(notFound).toBe(index.replace('<title>', '<base href="/">\n<title>'))
  })
})

describe('favicons', () => {
  it('are linked from both pages, whichever the site root holds, the sharper last', async () => {
    const { index, notFound } = await shell(
      { mode: 'hash', base: '/' },
      { 'favicon.svg': '<svg/>', 'favicon.ico': 'ico' },
    )
    const links =
      '<link rel="icon" href="favicon.ico" type="image/x-icon">\n<link rel="icon" href="favicon.svg" type="image/svg+xml">\n'

    expect(index).toContain(links)
    expect(notFound).toContain(links)
  })
})

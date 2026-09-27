import type { RouterConfig } from '../src/route.ts'
import * as v from 'valibot'
import { describe, expect, it } from 'vitest'
import { SiteSettingsSchema } from '../src/site/schema.ts'
import { writeShell } from '../src/site/shell.ts'
import { createMemoryVfs } from './memoryVfs.ts'

async function shell(
  router: RouterConfig,
  settings: Readonly<Record<string, unknown>> = {},
): Promise<{ index: string; notFound: string }> {
  const vfs = createMemoryVfs()
  await writeShell(vfs, v.parse(SiteSettingsSchema, { title: 'Test blog', router, ...settings }))

  return { index: await vfs.readFile('index.html'), notFound: await vfs.readFile('404.html') }
}

describe('404.html', () => {
  it('is index.html itself in path mode', async () => {
    const { index, notFound } = await shell({ mode: 'path', base: '/blog/' })

    expect(notFound).toBe(index)
    expect(index).toContain('<base href="/blog/">')
  })

  it('finds the site root from any depth in hash mode, where index.html at the root goes without a base', async () => {
    const { index, notFound } = await shell({ mode: 'hash', base: '/' })

    expect(index).not.toContain('<base')
    expect(notFound).toBe(index.replace('<title>', '<base href="/">\n<title>'))
  })

  it('is index.html itself in hash mode once the site has a base', async () => {
    const { index, notFound } = await shell({ mode: 'hash', base: '/blog/' })

    expect(notFound).toBe(index)
  })
})

describe('feed link', () => {
  it('points feed readers at atom.xml while the feed is on', async () => {
    const on = await shell({ mode: 'hash', base: '/' }, { url: 'https://example.com', atom: true })
    const off = await shell({ mode: 'hash', base: '/' })

    expect(on.index).toContain('<link rel="alternate" type="application/atom+xml" title="Test blog" href="atom.xml">')
    expect(off.index).not.toContain('application/atom+xml')
  })
})

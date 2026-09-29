import type { Diagnostic, PluginMeta } from '@bbg-next/core'
import { pluginConfigPath, pluginMetaPath, pluginPath } from '@bbg-next/core'
import { createMemoryVfs } from '@bbg-next/core/testing'
import { describe, expect, it } from 'vitest'
import { loadPlugins } from '../src/plugins.ts'

function meta(name: string, extra: Partial<PluginMeta> = {}): PluginMeta {
  return {
    name,
    version: '1.0.0',
    extensions: [],
    dependencies: {},
    requiredOptions: [],
    configurable: true,
    assets: [],
    ...extra,
  }
}

interface Install {
  readonly meta: PluginMeta
  readonly options?: Readonly<Record<string, unknown>>
}

/** Lays the installs out on disk and loads them in the order given, as sync does. */
async function load(installs: readonly Install[], strayFiles: Readonly<Record<string, string>> = {}) {
  const files: Record<string, string> = { ...strayFiles }

  for (const { meta: item, options } of installs) {
    files[pluginPath(item.name)] = ''
    files[pluginMetaPath(item.name)] = JSON.stringify(item)
    if (options !== undefined) files[pluginConfigPath(item.name)] = JSON.stringify(options)
  }

  const diagnostics: Diagnostic[] = []
  const entries = await loadPlugins(
    createMemoryVfs(files),
    installs.map(install => install.meta.name),
    diagnostics,
  )

  return { entries, names: entries.map(entry => entry.name), diagnostics }
}

describe('load order', () => {
  it('keeps the order the site declared, moving a plugin only behind what it depends on', async () => {
    const { names, diagnostics } = await load([
      { meta: meta('z') },
      { meta: meta('user', { dependencies: { base: '^1.0.0' } }) },
      { meta: meta('base') },
      { meta: meta('a') },
    ])

    // Not sorted: several markdown-it plugins layer in the order the author wrote them.
    expect(names).toEqual(['z', 'base', 'a', 'user'])
    expect(diagnostics).toEqual([])
  })

  it('reports a cycle instead of looping', async () => {
    const { names, diagnostics } = await load([
      { meta: meta('a', { dependencies: { b: '^1.0.0' } }) },
      { meta: meta('b', { dependencies: { a: '^1.0.0' } }) },
      { meta: meta('c') },
    ])

    expect(names).toEqual(['c'])
    expect(diagnostics[0]?.message).toMatch(/cycle/)
  })
})

describe('dependencies', () => {
  // Nothing else would catch this: plugins are copied in, so no resolver ever sees the mismatch.
  it('rejects a version the installed plugin does not satisfy', async () => {
    const { names, diagnostics } = await load([{ meta: meta('katex', { dependencies: { markdown: '^99.0.0' } }) }])

    expect(names).toEqual([])
    expect(diagnostics[0]?.message).toMatch(/markdown@\^99\.0\.0.*markdown@1\.0\.0/)
  })

  it('rejects a range it cannot parse rather than throwing', async () => {
    const { names, diagnostics } = await load([{ meta: meta('katex', { dependencies: { markdown: 'latest-ish' } }) }])

    expect(names).toEqual([])
    expect(diagnostics[0]?.message).toMatch(/markdown@latest-ish/)
  })

  it('drops whatever depended on a rejected plugin, and says so', async () => {
    const { names, diagnostics } = await load([
      { meta: meta('broken', { dependencies: { nope: '^1.0.0' } }) },
      { meta: meta('user', { dependencies: { broken: '^1.0.0' } }) },
      { meta: meta('fine') },
    ])

    expect(names).toEqual(['fine'])
    expect(diagnostics.map(item => item.message)).toContainEqual(expect.stringMatching(/Depends on broken/))
    // the knock-on must not be misreported as a cycle
    expect(diagnostics.map(item => item.message).join(' ')).not.toMatch(/cycle/)
  })
})

describe('renderers', () => {
  it('reject a claim on a suffix already rendered, markdown’s own included', async () => {
    const { diagnostics } = await load([
      { meta: meta('one', { extensions: ['typ'] }) },
      { meta: meta('two', { extensions: ['typ', 'md'] }) },
    ])

    expect(diagnostics.map(item => item.message)).toEqual([
      'Claims ".typ", which is already rendered by one',
      'Claims ".md", which is already rendered by the built-in markdown renderer',
    ])
  })
})

describe('config files', () => {
  const waline = meta('waline', { requiredOptions: ['serverURL'] })

  it('rejects one whose required options are missing, pointing at its config file', async () => {
    const { names, diagnostics } = await load([{ meta: waline }])

    expect(names).toEqual([])
    expect(diagnostics[0]?.message).toMatch(/needs these options: serverURL/)
    expect(diagnostics[0]?.file).toBe('data/plugins/waline.json')
  })

  it('drops a plugin whose config will not parse', async () => {
    const { entries, diagnostics } = await load([{ meta: waline }], { 'data/plugins/waline.json': '{ oops' })

    expect(entries).toEqual([])
    expect(diagnostics[0]).toMatchObject({ level: 'error', file: 'data/plugins/waline.json' })
  })

  // A misspelled filename is otherwise silent: the options simply never arrive.
  it('warns about a config no enabled plugin reads', async () => {
    const { diagnostics } = await load([{ meta: waline, options: { serverURL: 'https://x.test' } }], {
      'data/plugins/walien.json': '{}',
    })

    expect(diagnostics).toHaveLength(1)
    expect(diagnostics[0]).toMatchObject({ level: 'warn', file: 'data/plugins/walien.json' })
    expect(diagnostics[0]?.message).toMatch(/nothing reads it/)
  })
})

import type { Diagnostic, PluginMeta, Vfs } from '@bbg-next/core'
import { pluginConfigPath, pluginMetaPath, pluginPath } from '@bbg-next/core'
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
    ...extra,
  }
}

interface Install {
  readonly meta: PluginMeta
  readonly options?: Readonly<Record<string, unknown>>
}

/** Only the reads `loadPlugins` makes; writing would be a bug. */
function readOnlyVfs(files: Readonly<Record<string, string>>): Vfs {
  const unused = (): never => {
    throw new Error('loadPlugins must not write')
  }

  return {
    exists: async path => Object.hasOwn(files, path),

    readFile: async path => {
      const content = files[path]
      if (content === undefined) throw new Error(`ENOENT: ${path}`)

      return content
    },

    list: async dir =>
      Object.keys(files)
        .filter(path => path.startsWith(`${dir}/`))
        .map(path => path.slice(dir.length + 1)),

    writeFile: unused,
    remove: unused,
    copyIn: unused,
  }
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
    readOnlyVfs(files),
    installs.map(install => install.meta.name),
    diagnostics,
  )

  return { entries, names: entries.map(entry => entry.name), diagnostics }
}

describe('load order', () => {
  it('keeps declaration order when nothing depends on anything', async () => {
    const { names, diagnostics } = await load([{ meta: meta('c') }, { meta: meta('a') }, { meta: meta('b') }])

    // Not sorted: several markdown-it plugins layer in the order the author wrote them.
    expect(names).toEqual(['c', 'a', 'b'])
    expect(diagnostics).toEqual([])
  })

  it('puts a dependency ahead of its dependent', async () => {
    const { names } = await load([{ meta: meta('user', { dependencies: { base: '^1.0.0' } }) }, { meta: meta('base') }])

    expect(names).toEqual(['base', 'user'])
  })

  it('breaks ties by declaration order, not by name', async () => {
    const { names } = await load([
      { meta: meta('z') },
      { meta: meta('user', { dependencies: { base: '^1.0.0' } }) },
      { meta: meta('base') },
      { meta: meta('a') },
    ])

    expect(names).toEqual(['z', 'base', 'a', 'user'])
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
  it('accepts a dependency on a built-in', async () => {
    const { names, diagnostics } = await load([{ meta: meta('katex', { dependencies: { markdown: '^1.0.0' } }) }])

    expect(names).toEqual(['katex'])
    expect(diagnostics).toEqual([])
  })

  it('rejects a dependency that is not installed', async () => {
    const { names, diagnostics } = await load([{ meta: meta('katex', { dependencies: { nope: '^1.0.0' } }) }])

    expect(names).toEqual([])
    expect(diagnostics[0]?.message).toMatch(/not installed/)
  })

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
  it('rejects a second claim on one suffix', async () => {
    const { diagnostics } = await load([
      { meta: meta('one', { extensions: ['typ'] }) },
      { meta: meta('two', { extensions: ['typ'] }) },
    ])

    expect(diagnostics[0]?.message).toMatch(/already rendered by one/)
  })

  it('rejects a claim on markdown’s own suffix', async () => {
    const { diagnostics } = await load([{ meta: meta('rogue', { extensions: ['md'] }) }])

    expect(diagnostics[0]?.message).toMatch(/already rendered by the built-in markdown renderer/)
  })
})

describe('config files', () => {
  const waline = meta('waline', { requiredOptions: ['serverURL'] })

  it('takes a plugin’s options from its own config file', async () => {
    const { names, diagnostics } = await load([{ meta: waline, options: { serverURL: 'https://x.test' } }])

    expect(names).toEqual(['waline'])
    expect(diagnostics).toEqual([])
  })

  it('marks a plugin without a config file, so the runtime skips the fetch', async () => {
    const { entries, diagnostics } = await load([{ meta: meta('bare', { configurable: false }) }])

    expect(entries[0]?.hasConfig).toBe(false)
    expect(diagnostics).toEqual([])
  })

  it('rejects one whose required options are missing, pointing at its config file', async () => {
    const { names, diagnostics } = await load([{ meta: waline }])

    expect(names).toEqual([])
    expect(diagnostics[0]?.message).toMatch(/needs these options: serverURL/)
    expect(diagnostics[0]?.file).toBe('data/plugins/waline.json')
  })

  it('names every missing option at once', async () => {
    const { diagnostics } = await load([{ meta: meta('x', { requiredOptions: ['a', 'b'] }), options: { b: 1 } }])

    expect(diagnostics[0]?.message).toMatch(/options: a$/)
  })

  // Not "which is not installed": it is installed, just unusable.
  it('drops a dependent with an accurate reason', async () => {
    const { names, diagnostics } = await load([
      { meta: waline },
      { meta: meta('extra', { dependencies: { waline: '^1.0.0' } }) },
    ])

    expect(names).toEqual([])
    expect(diagnostics.map(item => item.message)).toContainEqual(expect.stringMatching(/Depends on waline/))
  })

  it('drops a plugin whose config will not parse', async () => {
    const { entries, diagnostics } = await load([{ meta: waline }], { 'data/plugins/waline.json': '{ oops' })

    expect(entries).toEqual([])
    expect(diagnostics[0]?.message).toMatch(/Not valid JSON/)
  })

  it('rejects a config that is not an object of options', async () => {
    const { entries, diagnostics } = await load([{ meta: waline }], { 'data/plugins/waline.json': '["serverURL"]' })

    expect(entries).toEqual([])
    expect(diagnostics[0]?.message).toMatch(/JSON object/)
  })

  it('warns about a config for a plugin that reads none, and keeps the plugin', async () => {
    const { names, entries, diagnostics } = await load([
      { meta: meta('bare', { configurable: false }), options: { x: 1 } },
    ])

    expect(names).toEqual(['bare'])
    expect(entries[0]?.hasConfig).toBe(false)
    expect(diagnostics[0]).toMatchObject({ level: 'warn', file: 'data/plugins/bare.json' })
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

  it('refuses a plugin.json that requires options while saying it takes none', async () => {
    const { entries, diagnostics } = await load([{ meta: { ...waline, configurable: false } }])

    expect(entries).toEqual([])
    expect(diagnostics[0]?.message).toMatch(/configurable/)
  })
})

describe('installed files', () => {
  it('reports a plugin the site enables but never installed', async () => {
    const diagnostics: Diagnostic[] = []
    const entries = await loadPlugins(readOnlyVfs({}), ['ghost'], diagnostics)

    expect(entries).toEqual([])
    expect(diagnostics[0]?.message).toMatch(/plugin add/)
  })

  // `theme add --name` renames on install; a hand-copied directory can still disagree.
  it('reports a plugin.json that names a directory other than its own', async () => {
    const diagnostics: Diagnostic[] = []
    const files = { [pluginPath('bare')]: '', [pluginMetaPath('bare')]: JSON.stringify(meta('elsewhere')) }
    const entries = await loadPlugins(readOnlyVfs(files), ['bare'], diagnostics)

    expect(entries).toEqual([])
    expect(diagnostics[0]?.message).toMatch(/but sits in/)
  })
})

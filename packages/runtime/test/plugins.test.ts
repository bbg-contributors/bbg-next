// @vitest-environment happy-dom
import type { PluginLoader } from '../src/plugins.ts'
import type { Manifest, PluginIndexEntry } from '@bbg-next/core'
import type { ColorScheme, MarkdownApi, PluginContext, PluginModule } from '@bbg-next/plugin'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setupPlugins } from '../src/plugins.ts'

function entry(name: string, extra: Partial<PluginIndexEntry> = {}): PluginIndexEntry {
  return { name, version: '1.0.0', extensions: [], dependencies: {}, hasConfig: false, ...extra }
}

function manifestWith(plugins: readonly PluginIndexEntry[]): Manifest {
  return {
    schemaVersion: 1,
    site: {
      title: 'Test',
      description: '',
      lang: 'en',
      footer: '',
      theme: 'default-theme',
      postsPerPage: 10,
      router: { mode: 'hash', base: '/' },
      plugins: plugins.map(item => item.name),
    },
    plugins,
    articles: [],
    hidden: [],
    pages: [],
  }
}

/** Stands in for the real loader, which imports an absolute http URL Node cannot. */
function loaderFor(modules: Readonly<Record<string, PluginModule>>): PluginLoader {
  return async url => {
    // bbg/plugins/<name>/index.js
    const name = url.split('/').at(-2)
    const module = name === undefined ? undefined : modules[name]
    if (module === undefined) throw new Error(`no bundle at ${url}`)

    return module
  }
}

const view = { element: document.createElement('div'), route: { type: 'home', page: 1 } as const }

describe('setupPlugins', () => {
  beforeEach(() => {
    // Failures are reported to the console by design; the tests assert on behaviour instead.
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('sets up in the order given and hands a dependency its API', async () => {
    const order: string[] = []
    const greeted: string[] = []

    await setupPlugins(
      manifestWith([entry('base'), entry('user', { dependencies: { base: '^1.0.0' } })]),
      loaderFor({
        base: {
          setup: () => {
            order.push('base')

            return { greet: () => 'hi' }
          },
        },
        user: {
          setup: context => {
            order.push('user')
            greeted.push(context.require<{ greet: () => string }>('base').greet())
          },
        },
      }),
    )

    expect(order).toEqual(['base', 'user'])
    expect(greeted).toEqual(['hi'])
  })

  // Loaded one at a time these would interleave: load, setup, load, setup.
  it('starts every bundle downloading before the first setup runs', async () => {
    const events: string[] = []

    await setupPlugins(manifestWith([entry('one'), entry('two')]), async url => {
      const name = url.split('/').at(-2)
      events.push(`load:${name}`)

      return { setup: () => void events.push(`setup:${name}`) }
    })

    expect(events).toEqual(['load:one', 'load:two', 'setup:one', 'setup:two'])
  })

  it('refuses a require the plugin never declared', async () => {
    let caught: unknown

    await setupPlugins(
      manifestWith([entry('base'), entry('sneak')]),
      loaderFor({
        base: { setup: () => ({}) },
        sneak: {
          setup: context => {
            try {
              context.require('base')
            } catch (cause) {
              caught = cause
            }
          },
        },
      }),
    )

    expect((caught as Error).message).toMatch(/without declaring it/)
  })

  it('keeps the site up when a plugin throws, and skips what depended on it', async () => {
    const ran: string[] = []

    const host = await setupPlugins(
      manifestWith([entry('broken'), entry('dependent', { dependencies: { broken: '^1.0.0' } }), entry('unrelated')]),
      loaderFor({
        broken: {
          setup: () => {
            throw new Error('boom')
          },
        },
        dependent: { setup: () => void ran.push('dependent') },
        unrelated: { setup: () => void ran.push('unrelated') },
      }),
    )

    expect(ran).toEqual(['unrelated'])
    // still usable: a bad plugin must not take the blog down with it
    expect(host.renderers.markdown('# Hi\n', {})).toContain('<h1>Hi</h1>')
  })

  it('survives a plugin bundle that will not load', async () => {
    const host = await setupPlugins(manifestWith([entry('missing')]), loaderFor({}))

    expect(host.renderers.markdown('# Hi\n', {})).toContain('<h1>Hi</h1>')
  })

  describe('renderers', () => {
    it('dispatches on the suffix and falls back to markdown', async () => {
      const host = await setupPlugins(
        manifestWith([entry('typst', { extensions: ['typ'] })]),
        loaderFor({
          typst: { setup: context => void context.registerRenderer('typ', () => '<h2>from typst</h2>') },
        }),
      )

      expect(host.renderers.for('a.typ')('ignored', {})).toBe('<h2>from typst</h2>')
      expect(host.renderers.for('a.md')('# Hi\n', {})).toContain('<h1>Hi</h1>')
      expect(host.renderers.for('no-suffix')('# Hi\n', {})).toContain('<h1>Hi</h1>')
    })

    it('keeps the first claim on a suffix', async () => {
      const host = await setupPlugins(
        manifestWith([entry('first', { extensions: ['typ'] }), entry('second', { extensions: ['typ'] })]),
        loaderFor({
          first: { setup: context => void context.registerRenderer('typ', () => 'first') },
          second: { setup: context => void context.registerRenderer('typ', () => 'second') },
        }),
      )

      expect(host.renderers.for('a.typ')('', {})).toBe('first')
    })

    it('will not let a plugin displace the built-in markdown renderer', async () => {
      const host = await setupPlugins(
        manifestWith([entry('rogue', { extensions: ['md'] })]),
        loaderFor({ rogue: { setup: context => void context.registerRenderer('md', () => 'hijacked') } }),
      )

      expect(host.renderers.for('a.md')('# Hi\n', {})).toContain('<h1>Hi</h1>')
    })
  })

  describe('config', () => {
    /** Records every request, so a test can assert on what was asked for and when. */
    function serve(configs: Readonly<Record<string, unknown>>, log: string[] = []): string[] {
      vi.stubGlobal('fetch', async (input: string | URL) => {
        const { pathname } = new URL(String(input), 'http://localhost:3000')
        log.push(`fetch:${pathname}`)
        const body = configs[pathname]

        return body === undefined ? new Response('nope', { status: 404 }) : new Response(JSON.stringify(body))
      })

      return log
    }

    afterEach(() => void vi.unstubAllGlobals())

    it('fetches one only for a plugin that has one, and hands it over', async () => {
      const asked = serve({ '/data/plugins/configured.json': { hello: 'world' } })
      const seen: unknown[] = []
      const push = (context: PluginContext): void => void seen.push(context.options)

      await setupPlugins(
        manifestWith([entry('configured', { hasConfig: true }), entry('bare')]),
        loaderFor({ configured: { setup: push }, bare: { setup: push } }),
      )

      expect(asked).toEqual(['fetch:/data/plugins/configured.json'])
      expect(seen).toEqual([{ hello: 'world' }, {}])
    })

    it('starts every fetch before the first setup runs', async () => {
      const events = serve({ '/data/plugins/one.json': {}, '/data/plugins/two.json': {} })

      await setupPlugins(
        manifestWith([entry('one', { hasConfig: true }), entry('two', { hasConfig: true })]),
        loaderFor({
          one: { setup: () => void events.push('setup:one') },
          two: { setup: () => void events.push('setup:two') },
        }),
      )

      // Fetched one at a time these would interleave: fetch, setup, fetch, setup.
      expect(events).toEqual(['fetch:/data/plugins/one.json', 'fetch:/data/plugins/two.json', 'setup:one', 'setup:two'])
    })

    it('carries on with defaults when a config cannot be read', async () => {
      serve({})
      const seen: unknown[] = []

      const host = await setupPlugins(
        manifestWith([entry('configured', { hasConfig: true })]),
        loaderFor({ configured: { setup: context => void seen.push(context.options) } }),
      )

      expect(seen).toEqual([{}])
      expect(host.renderers.markdown('# Hi\n', {})).toContain('<h1>Hi</h1>')
    })
  })

  describe('colour scheme', () => {
    /** Returns a setter that flips the scheme and notifies, the way the browser would. */
    function stubScheme(initial: ColorScheme): (next: ColorScheme) => void {
      const listeners = new Set<() => void>()
      const query = {
        matches: initial === 'dark',
        addEventListener: (_type: string, listener: () => void) => void listeners.add(listener),
        removeEventListener: (_type: string, listener: () => void) => void listeners.delete(listener),
      }

      vi.stubGlobal('matchMedia', () => query)

      return next => {
        query.matches = next === 'dark'
        for (const listener of [...listeners]) listener()
      }
    }

    function collect(seen: ColorScheme[]): PluginModule {
      return { setup: context => void context.onColorScheme(scheme => void seen.push(scheme)) }
    }

    afterEach(() => void vi.unstubAllGlobals())

    it('hands a plugin the scheme at setup, then every change', async () => {
      const set = stubScheme('light')
      const seen: ColorScheme[] = []

      await setupPlugins(manifestWith([entry('themed')]), loaderFor({ themed: collect(seen) }))
      expect(seen).toEqual(['light'])

      set('dark')
      set('light')
      expect(seen).toEqual(['light', 'dark', 'light'])
    })

    it('starts from dark when that is what the browser reports', async () => {
      stubScheme('dark')
      const seen: ColorScheme[] = []

      await setupPlugins(manifestWith([entry('themed')]), loaderFor({ themed: collect(seen) }))

      expect(seen).toEqual(['dark'])
    })

    it('isolates a handler that throws from the rest', async () => {
      const set = stubScheme('light')
      const seen: ColorScheme[] = []

      await setupPlugins(
        manifestWith([entry('bad'), entry('good')]),
        loaderFor({
          bad: {
            setup: context =>
              void context.onColorScheme(scheme => {
                if (scheme === 'dark') throw new Error('boom')
              }),
          },
          good: collect(seen),
        }),
      )

      set('dark')
      expect(seen).toEqual(['light', 'dark'])
    })

    // Otherwise a plugin the runtime skipped would keep getting called.
    it('leaves a plugin that throws on the first call unsubscribed', async () => {
      const set = stubScheme('light')
      let calls = 0

      const host = await setupPlugins(
        manifestWith([entry('broken')]),
        loaderFor({
          broken: {
            setup: context =>
              void context.onColorScheme(() => {
                calls += 1
                throw new Error('boom')
              }),
          },
        }),
      )

      expect(calls).toBe(1)

      set('dark')
      expect(calls).toBe(1)
      expect(host.renderers.markdown('# Hi\n', {})).toContain('<h1>Hi</h1>')
    })

    it('stops listening once torn down', async () => {
      const set = stubScheme('light')
      const seen: ColorScheme[] = []

      const host = await setupPlugins(manifestWith([entry('themed')]), loaderFor({ themed: collect(seen) }))
      host.teardown()
      set('dark')

      expect(seen).toEqual(['light'])
    })
  })

  it('lets a plugin extend markdown before anything is rendered', async () => {
    const host = await setupPlugins(
      manifestWith([entry('bolder', { dependencies: { markdown: '^1.0.0' } })]),
      loaderFor({
        bolder: {
          setup: context => {
            context.require<MarkdownApi>('markdown').use(md => void md.disable('emphasis'))
          },
        },
      }),
    )

    // The instance the plugin got is the one the site renders with.
    expect(host.renderers.markdown('*x*\n', {})).toContain('*x*')
  })

  describe('rendered hooks', () => {
    it('runs every handler, then their teardowns', async () => {
      const events: string[] = []

      const host = await setupPlugins(
        manifestWith([entry('one'), entry('two')]),
        loaderFor({
          one: {
            setup: context =>
              void context.onRendered(() => {
                events.push('one')

                return () => void events.push('one:down')
              }),
          },
          two: { setup: context => void context.onRendered(() => void events.push('two')) },
        }),
      )

      const teardown = host.rendered(view)
      expect(events).toEqual(['one', 'two'])

      teardown()
      expect(events).toEqual(['one', 'two', 'one:down'])
    })

    it('isolates a handler that throws from the rest', async () => {
      const events: string[] = []

      const host = await setupPlugins(
        manifestWith([entry('bad'), entry('good')]),
        loaderFor({
          bad: {
            setup: context =>
              void context.onRendered(() => {
                throw new Error('boom')
              }),
          },
          good: { setup: context => void context.onRendered(() => void events.push('good')) },
        }),
      )

      expect(() => host.rendered(view)).not.toThrow()
      expect(events).toEqual(['good'])
    })

    it('isolates a teardown that throws from the rest', async () => {
      const events: string[] = []

      const host = await setupPlugins(
        manifestWith([entry('bad'), entry('good')]),
        loaderFor({
          bad: {
            setup: context =>
              void context.onRendered(() => () => {
                throw new Error('boom')
              }),
          },
          good: { setup: context => void context.onRendered(() => () => void events.push('good:down')) },
        }),
      )

      const teardown = host.rendered(view)
      expect(() => teardown()).not.toThrow()
      expect(events).toEqual(['good:down'])
    })
  })
})

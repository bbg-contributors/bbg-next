// @vitest-environment happy-dom
import type { PluginLoader } from '../src/plugins.ts'
import type { Manifest, PluginIndexEntry } from '@bbg-next/core'
import type { ColorScheme, MarkdownApi, PluginContext, PluginModule } from '@bbg-next/plugin'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setupPlugins } from '../src/plugins.ts'
import { createColorScheme } from '../src/scheme.ts'
import { stubQuery } from './stubQuery.ts'

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
      articlesPerPage: 10,
      router: { mode: 'hash', base: '/' },
      url: '',
      atom: false,
      sitemap: false,
      plugins: plugins.map(item => item.name),
    },
    theme: { name: 'default-theme', version: '1.0.0', hasConfig: false },
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

/** boot owns the colour scheme; most of these tests only need one to exist. */
async function setup(manifest: Manifest, load: PluginLoader) {
  return setupPlugins(manifest, createColorScheme(), load)
}

const view = { element: document.createElement('div'), route: { type: 'home', page: 1 } as const, comments: false }

describe('setupPlugins', () => {
  beforeEach(() => {
    // Failures are reported to the console by design; the tests assert on behaviour instead.
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('sets up in the order given and hands a dependency its API', async () => {
    const order: string[] = []
    const greeted: string[] = []

    await setup(
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

    await setup(manifestWith([entry('one'), entry('two')]), async url => {
      const name = url.split('/').at(-2)
      events.push(`load:${name}`)

      return { setup: () => void events.push(`setup:${name}`) }
    })

    expect(events).toEqual(['load:one', 'load:two', 'setup:one', 'setup:two'])
  })

  it('refuses a require the plugin never declared', async () => {
    let caught: unknown

    await setup(
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

  it('keeps the site up when a plugin throws or will not load, and skips what depended on it', async () => {
    const ran: string[] = []

    const host = await setup(
      manifestWith([
        entry('broken'),
        entry('missing'),
        entry('dependent', { dependencies: { broken: '^1.0.0' } }),
        entry('unrelated'),
      ]),
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

  describe('theme and plugins knowing of each other', () => {
    // The theme dresses up for what is actually running, not for what the site merely asked for.
    it('reports only the plugins that set up, in load order', async () => {
      const host = await setup(
        manifestWith([
          entry('first'),
          entry('broken'),
          entry('dependent', { dependencies: { broken: '^1.0.0' } }),
          entry('missing'),
          entry('last', { version: '2.1.0' }),
        ]),
        loaderFor({
          first: { setup: () => {} },
          broken: {
            setup: () => {
              throw new Error('boom')
            },
          },
          dependent: { setup: () => {} },
          last: { setup: () => {} },
        }),
      )

      expect(host.started).toEqual([
        { name: 'first', version: '1.0.0' },
        { name: 'last', version: '2.1.0' },
      ])
    })
  })

  describe('renderers', () => {
    it('dispatches on the suffix and falls back to markdown', async () => {
      const host = await setup(
        manifestWith([entry('typst', { extensions: ['typ'] })]),
        loaderFor({
          typst: { setup: context => void context.registerRenderer('typ', () => '<h2>from typst</h2>') },
        }),
      )

      expect(host.renderers.for('a.typ')('ignored', {})).toBe('<h2>from typst</h2>')
      expect(host.renderers.for('a.md')('# Hi\n', {})).toContain('<h1>Hi</h1>')
      expect(host.renderers.for('no-suffix')('# Hi\n', {})).toContain('<h1>Hi</h1>')
    })

    it('will not let a plugin displace the built-in markdown renderer', async () => {
      const host = await setup(
        manifestWith([entry('rogue', { extensions: ['md'] })]),
        loaderFor({ rogue: { setup: context => void context.registerRenderer('md', () => 'hijacked') } }),
      )

      expect(host.renderers.for('a.md')('# Hi\n', {})).toContain('<h1>Hi</h1>')
    })
  })

  describe('redirects', () => {
    it('asks in load order, past one that throws, and takes the first route given', async () => {
      const host = await setup(
        manifestWith([entry('broken'), entry('unknowing'), entry('first'), entry('second')]),
        loaderFor({
          broken: {
            setup: context =>
              void context.registerRedirect(() => {
                throw new Error('boom')
              }),
          },
          unknowing: { setup: context => void context.registerRedirect(() => null) },
          first: { setup: context => void context.registerRedirect(() => ({ type: 'archive' })) },
          second: { setup: context => void context.registerRedirect(() => ({ type: 'home', page: 1 })) },
        }),
      )

      expect(host.redirect(new URL('http://localhost:3000/?old=1'))).toEqual({ type: 'archive' })
    })
  })

  describe('links', () => {
    beforeEach(() => void document.head.append(Object.assign(document.createElement('base'), { href: '/blog/' })))

    afterEach(() => void document.querySelector('base')?.remove())

    it('lead where the document is served, as the runtime’s own do, whatever site.json says', async () => {
      const manifest = manifestWith([entry('linker')])
      let href = ''

      await setup(
        { ...manifest, site: { ...manifest.site, router: { mode: 'path', base: '/' } } },
        loaderFor({ linker: { setup: context => void (href = context.href({ type: 'article', slug: 'a' })) } }),
      )

      expect(href).toBe('/blog/article/a/')
    })
  })

  describe('config', () => {
    /** Records every request, so a test can assert on what was asked for. */
    function serve(configs: Readonly<Record<string, unknown>>): string[] {
      const log: string[] = []
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

      await setup(
        manifestWith([entry('configured', { hasConfig: true }), entry('bare')]),
        loaderFor({ configured: { setup: push }, bare: { setup: push } }),
      )

      expect(asked).toEqual(['fetch:/data/plugins/configured.json'])
      expect(seen).toEqual([{ hello: 'world' }, {}])
    })

    it('carries on with defaults when a config cannot be read', async () => {
      serve({})
      const seen: unknown[] = []

      const host = await setup(
        manifestWith([entry('configured', { hasConfig: true })]),
        loaderFor({ configured: { setup: context => void seen.push(context.options) } }),
      )

      expect(seen).toEqual([{}])
      expect(host.renderers.markdown('# Hi\n', {})).toContain('<h1>Hi</h1>')
    })
  })

  describe('colour scheme', () => {
    afterEach(() => void vi.unstubAllGlobals())

    it('hands a plugin the scheme at setup, then every change', async () => {
      const set = stubQuery('light')
      const seen: ColorScheme[] = []

      await setup(
        manifestWith([entry('themed')]),
        loaderFor({ themed: { setup: context => void context.onColorScheme(scheme => void seen.push(scheme)) } }),
      )
      expect(seen).toEqual(['light'])

      set('dark')
      set('light')
      expect(seen).toEqual(['light', 'dark', 'light'])
    })

    // Otherwise a plugin the runtime skipped would keep getting called.
    it('leaves a plugin that throws on the first call unsubscribed', async () => {
      const set = stubQuery('light')
      let calls = 0

      const host = await setup(
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
  })

  it('lets a plugin extend markdown before anything is rendered', async () => {
    const host = await setup(
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
    it('isolates a handler that throws from the rest', async () => {
      const events: string[] = []

      const host = await setup(
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
  })
})

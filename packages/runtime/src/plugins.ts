import type { Manifest, PluginIndexEntry } from '@bbg-next/core'
import type {
  ColorScheme,
  MarkdownApi,
  PluginApi,
  PluginContext,
  PluginModule,
  RenderedHandler,
  RenderedView,
  Renderer,
} from '@bbg-next/plugin'
import { createMarkdown, defaultExtensions, pluginConfigPath, pluginPath, renderMarkdown } from '@bbg-next/core'
import { resolve } from './site.ts'

type Options = PluginContext['options']

export type PluginLoader = (url: string) => Promise<PluginModule>

const importPlugin: PluginLoader = async url => (await import(/* @vite-ignore */ url)) as PluginModule

// no-cache like the manifest: a deploy changes it.
async function fetchConfig(name: string): Promise<Options> {
  const path = pluginConfigPath(name)
  const response = await fetch(resolve(path), { cache: 'no-cache' })
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${path}`)

  const parsed: unknown = await response.json()
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new TypeError(`${path} does not hold a JSON object`)
  }

  return parsed as Options
}

export interface RendererRegistry {
  /** By suffix, falling back to markdown. */
  readonly for: (file: string) => Renderer
  /** The footer is markdown whatever else is installed. */
  readonly markdown: Renderer
}

export interface PluginHost {
  readonly renderers: RendererRegistry
  readonly rendered: (view: RenderedView) => () => void
  /** Releases the document-level listeners this took out. */
  readonly teardown: () => void
}

const markdownPlugin = 'markdown'

// A blog is no place to fail loudly at a visitor: log and carry on with what does work.
function report(message: string, ...cause: unknown[]): void {
  console.error(`bbg-next: ${message}`, ...cause)
}

/** Must finish before the first render: a plugin extending markdown has to get at it first. */
export async function setupPlugins(manifest: Manifest, load: PluginLoader = importPlugin): Promise<PluginHost> {
  const renderers = new Map<string, Renderer>()
  const handlers: RenderedHandler[] = []
  const apis = new Map<string, PluginApi>()
  const ready = new Set([markdownPlugin])

  const schemeHandlers: ((scheme: ColorScheme) => void)[] = []
  const darkQuery = matchMedia('(prefers-color-scheme: dark)')
  const colorScheme = (): ColorScheme => (darkQuery.matches ? 'dark' : 'light')

  const onSchemeChange = (): void => {
    const scheme = colorScheme()

    for (const handler of schemeHandlers) {
      try {
        handler(scheme)
      } catch (cause) {
        report('a plugin failed while handling a colour scheme change', cause)
      }
    }
  }

  darkQuery.addEventListener('change', onSchemeChange)

  const md = createMarkdown()
  const markdown: Renderer = (source, context) => renderMarkdown(md, source, context)
  const markdownApi: MarkdownApi = { use: (plugin, ...params) => void md.use(plugin, ...params), instance: md }
  apis.set(markdownPlugin, markdownApi)
  // Claimed rather than dispatched — `for` already falls back to markdown — so no plugin can take these over.
  for (const extension of defaultExtensions) renderers.set(extension, markdown)

  // Every download starts up front: nothing may queue behind the plugin ahead of it.
  const pending = manifest.plugins.map(entry => {
    const loading = load(resolve(pluginPath(entry.name)))
    // A skipped plugin is never awaited, and an unhandled rejection is noise.
    void loading.catch(() => {})

    const options = entry.hasConfig
      ? fetchConfig(entry.name).catch((cause: unknown): Options => {
          report(`cannot read the config for ${entry.name}`, cause)

          return {}
        })
      : Promise.resolve<Options>({})

    return { entry, loading, options }
  })

  function contextFor(entry: PluginIndexEntry, options: Options): PluginContext {
    return {
      options,
      site: manifest.site,
      onRendered: handler => void handlers.push(handler),
      // Subscribed only once it has survived the first call, so a plugin that fails to start stays out.
      onColorScheme: handler => {
        handler(colorScheme())
        schemeHandlers.push(handler)
      },
      registerRenderer: (extension, render) => {
        if (!entry.extensions.includes(extension)) {
          report(`plugin ${entry.name} renders ".${extension}" without listing it, so sync ignores those files`)
        }
        if (renderers.has(extension)) {
          report(`".${extension}" already has a renderer; ignoring the one from ${entry.name}`)

          return
        }
        renderers.set(extension, render)
      },
      require: <T extends PluginApi>(name: string): T => {
        if (!Object.hasOwn(entry.dependencies, name)) {
          throw new Error(`Plugin ${entry.name} requires ${JSON.stringify(name)} without declaring it in plugin.json`)
        }

        const api = apis.get(name)
        if (api === undefined) throw new Error(`Plugin ${JSON.stringify(name)} exposes no API`)

        return api as T
      },
    }
  }

  for (const { entry, loading, options } of pending) {
    const unmet = Object.keys(entry.dependencies).filter(name => !ready.has(name))
    if (unmet.length > 0) {
      report(`skipping plugin ${entry.name}: it needs ${unmet.join(', ')}, which did not load`)
      continue
    }

    try {
      const api = (await loading).setup(contextFor(entry, await options))
      ready.add(entry.name)
      if (api !== undefined) apis.set(entry.name, api)
    } catch (cause) {
      report(`plugin ${entry.name} failed to start`, cause)
    }
  }

  return {
    teardown: () => void darkQuery.removeEventListener('change', onSchemeChange),

    renderers: {
      markdown,
      for: file => renderers.get(file.slice(file.lastIndexOf('.') + 1)) ?? markdown,
    },
    rendered: view => {
      const teardowns: (() => void)[] = []

      for (const handler of handlers) {
        try {
          const teardown = handler(view)
          if (teardown !== undefined) teardowns.push(teardown)
        } catch (cause) {
          report('a plugin failed while handling a render', cause)
        }
      }

      return () => {
        for (const teardown of teardowns) {
          try {
            teardown()
          } catch (cause) {
            report('a plugin failed while tearing down', cause)
          }
        }
      }
    },
  }
}

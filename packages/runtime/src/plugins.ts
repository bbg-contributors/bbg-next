import type { Manifest, PluginIndexEntry } from '@bbg-next/core'
import type {
  ColorScheme,
  MarkdownApi,
  PluginApi,
  PluginContext,
  PluginModule,
  RenderedView,
  Renderer,
} from '@bbg-next/plugin'
import type { ColorSchemeControl, PluginInfo } from '@bbg-next/view'
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
  readonly rendered: (view: RenderedView) => void
  /** The plugins whose setup went through, in load order: what the theme is told is running. */
  readonly started: readonly PluginInfo[]
}

const markdownPlugin = 'markdown'

// A blog is no place to fail loudly at a visitor: log and carry on with what does work.
function report(message: string, ...cause: unknown[]): void {
  console.error(`bbg-next: ${message}`, ...cause)
}

interface Handlers<T> {
  readonly add: (handler: (value: T) => void) => void
  readonly fire: (value: T) => void
}

/** Plugin callbacks of one kind, `what` naming it. One that throws is reported, and the rest still run. */
function handlers<T>(what: string): Handlers<T> {
  const added: ((value: T) => void)[] = []

  return {
    add: handler => void added.push(handler),
    fire: value => {
      for (const handler of added) {
        try {
          handler(value)
        } catch (cause) {
          report(`a plugin failed while handling ${what}`, cause)
        }
      }
    },
  }
}

/** Must finish before the first render: a plugin extending markdown has to get at it first. */
export async function setupPlugins(
  manifest: Manifest,
  colorScheme: ColorSchemeControl,
  load: PluginLoader = importPlugin,
): Promise<PluginHost> {
  const renderers = new Map<string, Renderer>()
  const apis = new Map<string, PluginApi>()
  const ready = new Set([markdownPlugin])

  const rendered = handlers<RenderedView>('a render')
  const schemes = handlers<ColorScheme>('a colour scheme change')
  colorScheme.subscribe(schemes.fire)

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
      theme: manifest.theme,
      onRendered: rendered.add,
      // Subscribed only once it has survived the first call, so a plugin that fails to start stays out.
      onColorScheme: handler => {
        handler(colorScheme.current())
        schemes.add(handler)
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

  const started: PluginInfo[] = []

  for (const { entry, loading, options } of pending) {
    const unmet = Object.keys(entry.dependencies).filter(name => !ready.has(name))
    if (unmet.length > 0) {
      report(`skipping plugin ${entry.name}: it needs ${unmet.join(', ')}, which did not load`)
      continue
    }

    try {
      const api = (await loading).setup(contextFor(entry, await options))
      ready.add(entry.name)
      started.push({ name: entry.name, version: entry.version })
      if (api !== undefined) apis.set(entry.name, api)
    } catch (cause) {
      report(`plugin ${entry.name} failed to start`, cause)
    }
  }

  return {
    started,
    rendered: rendered.fire,

    renderers: {
      markdown,
      for: file => renderers.get(file.slice(file.lastIndexOf('.') + 1)) ?? markdown,
    },
  }
}

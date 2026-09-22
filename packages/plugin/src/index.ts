// The runtime/plugin contract. A plugin extends what gets rendered, or reacts to what was.

import type { RenderContext, Route, SiteSettings } from '@bbg-next/core'
import type { MarkdownIt } from 'markdown-it'

/** Re-exported so a plugin only ever depends on this package. */
export type { RenderContext, Route, SiteSettings } from '@bbg-next/core'

/** Front matter is already stripped. */
export type Renderer = (source: string, context: RenderContext) => string

/** Return a teardown and the runtime calls it before the next navigation. */
export type RenderedHandler = (view: RenderedView) => void | (() => void)

export type ColorScheme = 'light' | 'dark'

export interface RenderedView {
  /** Already connected, and light DOM, so it is queryable. */
  readonly element: HTMLElement
  readonly route: Route
}

/** What `setup` returns, handed to plugins that declared this one as a dependency. */
export type PluginApi = object

export interface PluginContext {
  /** From `data/plugins/<name>.json`, `{}` without one. Unvalidated: validate what you read. */
  readonly options: Readonly<Record<string, unknown>>
  readonly site: SiteSettings
  /** Format-agnostic work goes here. */
  readonly onRendered: (handler: RenderedHandler) => void
  /** Called with the scheme now, and again whenever it changes. The theme's own colours are not yours to read. */
  readonly onColorScheme: (handler: (scheme: ColorScheme) => void) => void
  /** Claim a suffix, no dot. Must match `extensions` in plugin.json, which is what sync reads. */
  readonly registerRenderer: (extension: string, render: Renderer) => void
  /** The API of a plugin declared as a dependency in plugin.json; throws otherwise. */
  readonly require: <T extends PluginApi>(name: string) => T
}

export type PluginSetup = (context: PluginContext) => PluginApi | void

/** A plugin's module namespace is this shape, the way a theme's is `ThemeModule`. */
export interface PluginModule {
  readonly setup: PluginSetup
}

/** Identity, so `context` types itself. */
export function definePlugin(setup: PluginSetup): PluginSetup {
  return setup
}

type Options = Readonly<Record<string, unknown>>

export function readString(options: Options, key: string, fallback: string): string {
  const value = options[key]

  return typeof value === 'string' ? value : fallback
}

export function readStrings(options: Options, key: string, fallback: readonly string[]): readonly string[] {
  const value = options[key]
  if (!Array.isArray(value)) return fallback

  return value.every(item => typeof item === 'string') ? value : fallback
}

/** Keyed on `id`: calling it again replaces that stylesheet, which is how a plugin repaints. */
export function injectStyle(id: string, css: string): void {
  const existing = document.getElementById(id)
  if (existing !== null) {
    existing.textContent = css

    return
  }

  const style = document.createElement('style')
  style.id = id
  style.textContent = css
  document.head.append(style)
}

/** Depend on it as `{ "markdown": "^1.0.0" }`. Changing this bumps `builtinPlugins` in core. */
export interface MarkdownApi {
  readonly use: <Params extends unknown[]>(
    plugin: (md: MarkdownIt, ...params: Params) => void,
    ...params: Params
  ) => void
  readonly instance: MarkdownIt
}

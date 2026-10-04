// The runtime/plugin contract. A plugin extends what gets rendered, or reacts to what was.

import type { ArticleEntry, PageEntry, RenderContext, Route, SiteSettings } from '@bbg-next/core'
import type { ColorScheme, ShellAction } from '@bbg-next/view'
import type { MarkdownIt } from 'markdown-it'
import { serializeRoute } from '@bbg-next/core'

/** Re-exported so a plugin only ever depends on this package. */
export type { ArticleEntry, PageEntry, RenderContext, Route, SiteSettings } from '@bbg-next/core'
export { type ColorScheme, injectStyle, type ShellAction, wordFor } from '@bbg-next/view'

/** Front matter is already stripped. */
export type Renderer = (source: string, context: RenderContext) => string

/** The route an address the router does not know stands for, such as one from another generator; `null` for one this plugin does not know either. */
export type Redirect = (url: URL) => Route | null

/** Called after every navigation with the view on screen. Its element stays from one view of a kind to the next, and what you put in it stays with it: keep what still holds, change only what differs, and take out what no longer belongs. */
export type RenderedHandler = (view: RenderedView) => void

export interface RenderedView {
  /** Already connected, and light DOM, so it is queryable. A different element than last time means the last one, and all you put in it, is gone. On an article or a page, the document itself is its `.bbg-content`. */
  readonly element: HTMLElement
  readonly route: Route
  /** Whether a comment thread belongs here: only on an article or a page, and only if its front matter leaves `comments` on. */
  readonly comments: boolean
}

/** What `setup` returns, handed to plugins that declared this one as a dependency. */
export type PluginApi = object

/** The theme installed, for a plugin made to go with a particular one. */
export interface ThemeInfo {
  readonly name: string
  readonly version: string
}

export interface PluginContext {
  /** From `data/plugins/<name>.json`, `{}` without one. Unvalidated: validate what you read. */
  readonly options: Readonly<Record<string, unknown>>
  /** `site.seed` is the site's brand colour, if it set one, for a plugin that derives shades of its own. */
  readonly site: SiteSettings
  readonly theme: ThemeInfo
  /** Pinned first, then newest. */
  readonly articles: readonly ArticleEntry[]
  /** Apart from `articles`, so nothing lists them by accident. */
  readonly hidden: readonly ArticleEntry[]
  readonly pages: readonly PageEntry[]
  /** Where `route` is on this site: a link there is followed without a reload. */
  readonly href: (route: Route) => string
  /** Format-agnostic work goes here. */
  readonly onRendered: (handler: RenderedHandler) => void
  /** Called with the scheme now, and again whenever it changes. A theme's colours reach you only through the shared tokens `--bbg-fg`, `--bbg-muted`, `--bbg-accent`, `--bbg-on-accent`, `--bbg-bg`, `--bbg-surface`, `--bbg-border`, `--bbg-radius` and `--bbg-shadow`, any of which may be unset, so read each with a fallback. */
  readonly onColorScheme: (handler: (scheme: ColorScheme) => void) => void
  /** Claim a suffix, no dot. Must match `extensions` in plugin.json, which is what sync reads. */
  readonly registerRenderer: (extension: string, render: Renderer) => void
  /** Asked about the address the site opens at and every same-origin link followed within it; the first route any plugin gives wins. */
  readonly registerRedirect: (redirect: Redirect) => void
  /** During setup only: a button the theme draws among its bar's controls. */
  readonly registerAction: (action: ShellAction) => void
  /** The API of a plugin declared as a dependency in plugin.json; throws otherwise. */
  readonly require: <T extends PluginApi>(name: string) => T
}

/** Runs before the runtime reads the address, so it may still move it with `history.replaceState`. */
export type PluginSetup = (context: PluginContext) => PluginApi | void

/** A plugin's module namespace is this shape, the way a theme's is `ThemeModule`. It may also define a `bbg-<its name>` element, which authors place with a fence of that name: the fence's content arrives in `data-source`, which marks what the element shows as drawn from it rather than the document's own words, and in `data-base` the directory the document resolves its own relative links against. Style what you draw unlayered, so a theme's resets cannot flatten it, and document any `--bbg-<your name>-*` property a theme may set to fit you in. Give your buttons the `bbg-button` class: the runtime draws a plain one from the shared tokens, a theme may draw it its own way or add effects such as a ripple, and any rule of yours outranks the runtime's. Mark what you put into a view with `data-bbg-plugin` set to your name, and leave what others marked alone when you act on a view's content. */
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

/** The key of a view's comment thread: its path on a site served from the root, whichever way the site routes, so both modes agree on it. */
export function threadPath(route: Route): string {
  return serializeRoute(route, { mode: 'path', base: '/' })
}

/** The view's address for a service outside the site, such as a comment service linking a notification to one comment: the route is in the path, which survives the service replacing the fragment, and 404.html shows the site there. */
export function permalink(route: Route): string {
  return new URL(`.${threadPath(route)}`, document.baseURI).href
}

/** The site's markdown-it instance. Depend on it as `{ "markdown": "^1.0.0" }`. Changing this bumps `builtinPlugins` in core. */
export type MarkdownApi = MarkdownIt

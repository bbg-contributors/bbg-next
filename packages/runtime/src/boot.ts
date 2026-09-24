import type { PluginLoader } from './plugins.ts'
import type { RenderContext, Route } from '@bbg-next/core'
import type { ThemeModule } from '@bbg-next/view'
import { outletElement, parseFragment, parseRoute, serializeRoute, themePath } from '@bbg-next/core'
import { injectStyle, themeElements } from '@bbg-next/view'
import { defineEncrypted } from './encrypted.ts'
import { setupPlugins } from './plugins.ts'
import { mount, place, renderRoute, setModel } from './render.ts'
import { createColorScheme } from './scheme.ts'
import { createVisits, reveal, scrollBack } from './scroll.ts'
import { createSite, loadManifest, resolve } from './site.ts'
import { css } from './style.ts'

/** Injectable: the default imports an absolute http URL, which only a browser can do. */
export type ThemeLoader = (url: string) => Promise<ThemeModule>

const importTheme: ThemeLoader = async url => (await import(/* @vite-ignore */ url)) as ThemeModule

/** Returns a teardown for the document-level listeners, so this can run twice in one process. */
export async function start(loadTheme: ThemeLoader = importTheme, loadPlugin?: PluginLoader): Promise<() => void> {
  const outlet = document.querySelector(outletElement)
  if (outlet === null) throw new Error(`Missing <${outletElement}> in the document`)

  const manifest = await loadManifest()

  // Started before the plugins, which it waits on none of.
  const loadingTheme = loadTheme(resolve(themePath(manifest.site.theme)))
  // or a 404 here looks unhandled until the await below
  void loadingTheme.catch(() => {})

  // One for the plugins and the theme alike, so the two can never disagree.
  const scheme = createColorScheme()

  // Before createSite, which renders the footer.
  const plugins = await setupPlugins(manifest, scheme.colorScheme, loadPlugin)
  const site = createSite(manifest, plugins.renderers)

  // A block decrypted later renders the way the document around it did.
  let context: RenderContext = {}
  injectStyle('bbg-runtime', css)
  defineEncrypted({ render: markdown => site.renderers.markdown(markdown, context), words: site.words })

  const theme = await loadingTheme
  theme.register({ colorScheme: scheme.colorScheme, seed: manifest.site.seed, plugins: plugins.started })

  const locate = (url: URL): { route: Route | null; fragment: string } => ({
    route: parseRoute(url, site.router),
    fragment: parseFragment(url, site.router),
  })
  const landing = locate(new URL(location.href))

  // Mounted with a model, as the contract promises every element; show then hands the shell a new one whenever it changes.
  let shell = site.shell(landing.route)
  const header = mount(themeElements.header, shell)
  const footer = mount(themeElements.footer, shell)
  const view = document.createElement('div')
  view.className = 'bbg-view'
  outlet.replaceChildren(header, view, footer)

  // Moving within the document on screen only scrolls.
  let shownHref: string | null = null
  const onScreen = (route: Route | null): boolean => route !== null && serializeRoute(route, site.router) === shownHref

  const visits = createVisits()

  const show = async (route: Route | null, fragment: string, position?: number): Promise<void> => {
    shownHref = route === null ? null : serializeRoute(route, site.router)

    // Ahead of the fetch, so the bar follows the click rather than the network. From one article to another no mark moves, and nothing is sent.
    const next = site.shell(route)
    if (JSON.stringify(next) !== JSON.stringify(shell)) {
      shell = next
      setModel(header, next)
      setModel(footer, next)
    }

    const rendered = await renderRoute(site, route)
    context = rendered.context
    const element = place(view, rendered)
    // Once it is on screen: plugins need the element connected.
    if (route !== null && rendered.tag !== null) plugins.rendered({ element, route, comments: rendered.comments })
    document.title = rendered.title
    // Instant, or a theme's smooth scrolling would glide there from wherever the last view was left.
    if (position === undefined) reveal(fragment, 'instant')
    else scrollBack(position, element)
  }

  const navigate = async (route: Route, fragment: string): Promise<void> => {
    history.pushState(visits.next(), '', serializeRoute(route, site.router, fragment))
    if (onScreen(route)) reveal(fragment, 'auto')
    else await show(route, fragment)
  }

  const onPopState = (event: PopStateEvent): void => {
    const position = visits.resume(event.state)
    const { route, fragment } = locate(new URL(location.href))
    if (!onScreen(route)) void show(route, fragment, position)
    else if (position === undefined) reveal(fragment, 'auto')
    else scrollTo({ top: position, behavior: 'instant' })
  }

  const onClick = (event: MouseEvent): void => {
    if (event.defaultPrevented || event.button !== 0) return
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

    // composedPath, not target: a click inside a shadow root is retargeted to the host.
    const anchor = event.composedPath().find((node): node is HTMLAnchorElement => node instanceof HTMLAnchorElement)
    if (anchor === undefined) return
    if (anchor.target !== '' && anchor.target !== '_self') return
    if (anchor.hasAttribute('download')) return

    const url = new URL(anchor.href, document.baseURI)
    if (url.origin !== location.origin) return

    const { route, fragment } = locate(url)
    if (route === null) return

    event.preventDefault()
    void navigate(route, fragment)
  }

  addEventListener('popstate', onPopState)
  document.addEventListener('click', onClick)

  history.replaceState(visits.next(), '', location.href)
  await show(landing.route, landing.fragment)

  return () => {
    removeEventListener('popstate', onPopState)
    document.removeEventListener('click', onClick)
    visits.teardown()
    scheme.teardown()
  }
}

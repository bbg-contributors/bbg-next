import type { PluginLoader } from './plugins.ts'
import type { RenderContext, Route } from '@bbg-next/core'
import type { ThemeModule } from '@bbg-next/view'
import {
  outletElement,
  parseFragment,
  parseRoute,
  resolveDeepLink,
  serializeRoute,
  themeConfigPath,
  themePath,
} from '@bbg-next/core'
import { injectStyle, themeElements } from '@bbg-next/view'
import { defineEncrypted } from './encrypted.ts'
import { setupPlugins } from './plugins.ts'
import { mount, place, renderRoute, setModel } from './render.ts'
import { createColorScheme } from './scheme.ts'
import { createVisits, reveal, scrollBack } from './scroll.ts'
import { createSite, loadManifest, loadOptions, resolve } from './site.ts'
import { css } from './style.ts'

/** Injectable: the default imports an absolute http URL, which only a browser can do. */
type ThemeLoader = (url: string) => Promise<ThemeModule>

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
  const themeOptions = manifest.theme.hasConfig
    ? loadOptions(themeConfigPath(manifest.site.theme))
    : Promise.resolve({})

  // One for the plugins and the theme alike, so the two can never disagree.
  const colorScheme = createColorScheme()

  // Before createSite, which renders the footer.
  const plugins = await setupPlugins(manifest, colorScheme, loadPlugin)
  const site = createSite(manifest, plugins.renderers)

  // A block decrypted later renders the way the document around it did.
  let context: RenderContext = {}
  injectStyle('bbg-runtime', css)
  defineEncrypted({ render: markdown => site.renderers.markdown(markdown, context), words: site.words })

  const theme = await loadingTheme
  theme.register({ colorScheme, seed: manifest.site.seed, options: await themeOptions, plugins: plugins.started })

  const locate = (url: URL): { route: Route | null; fragment: string } => ({
    route: parseRoute(url, site.router),
    fragment: parseFragment(url, site.router),
  })
  // Opened at an address a plugin knows, such as another generator's: move to the route's own. Repeated slashes go too, as the old editor's feeds wrote `//index.html`.
  const claimed = plugins.redirect(new URL(location.href))
  if (claimed !== null) {
    const own = new URL(serializeRoute(claimed, site.router), document.baseURI)
    own.search = ''
    own.pathname = own.pathname.replaceAll(/\/{2,}/g, '/')
    history.replaceState(null, '', own)
  }
  // Opened below the root through 404.html, as a comment notification links to a comment: move the route where hash mode keeps it.
  const deepLink = resolveDeepLink(location, site.router)
  if (deepLink !== null) history.replaceState(null, '', deepLink)
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
  let shows = 0

  const show = async (route: Route | null, fragment: string, position?: number): Promise<void> => {
    const ticket = (shows += 1)
    shownHref = route === null ? null : serializeRoute(route, site.router)

    // Ahead of the fetch, so the bar follows the click rather than the network. From one article to another no mark moves, and nothing is sent.
    const next = site.shell(route)
    if (JSON.stringify(next) !== JSON.stringify(shell)) {
      shell = next
      setModel(header, next)
      setModel(footer, next)
    }

    const rendered = await renderRoute(site, route)
    // The reader has moved on while this was on its way.
    if (ticket !== shows) return

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

  /** Where a same-origin link leads within the site, `null` for one the browser should open itself. */
  const destination = (url: URL): { route: Route; fragment: string } | null => {
    const redirected = plugins.redirect(url)
    if (redirected !== null) return { route: redirected, fragment: '' }

    // The router's own links carry no query of their own, and in hash mode the route in the fragment: anything else, an attachment say, is not a view.
    if (url.search !== '' && url.search !== location.search) return null
    if (site.router.mode === 'hash' && url.hash === '') return null

    const { route, fragment } = locate(url)

    return route === null ? null : { route, fragment }
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

    const found = destination(url)
    if (found === null) return

    event.preventDefault()
    void navigate(found.route, found.fragment)
  }

  const lifetime = new AbortController()
  addEventListener('popstate', onPopState, { signal: lifetime.signal })
  document.addEventListener('click', onClick, { signal: lifetime.signal })

  history.replaceState(visits.next(), '', location.href)
  await show(landing.route, landing.fragment)

  return () => lifetime.abort()
}

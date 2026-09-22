import type { PluginLoader } from './plugins.ts'
import type { Route } from '@bbg-next/core'
import type { ThemeModule } from '@bbg-next/view'
import { outletElement, parseRoute, serializeRoute, themePath } from '@bbg-next/core'
import { themeElements } from '@bbg-next/view'
import { setupPlugins } from './plugins.ts'
import { mount, renderRoute } from './render.ts'
import { createSite, loadManifest, resolve } from './site.ts'

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

  // Before createSite, which renders the footer.
  const plugins = await setupPlugins(manifest, loadPlugin)
  const site = createSite(manifest, plugins.renderers)

  const theme = await loadingTheme
  theme.register()

  const view = document.createElement('div')
  view.className = 'bbg-view'
  outlet.replaceChildren(mount(themeElements.header, site.shell), view, mount(themeElements.footer, site.shell))

  let cleanup = (): void => {}

  const show = async (route: Route | null): Promise<void> => {
    cleanup()

    const rendered = await renderRoute(site, route)
    view.replaceChildren(rendered.element)
    // After replaceChildren: plugins need the element connected. A null route is the runtime's own not-found view, not a document.
    cleanup = route === null ? () => {} : plugins.rendered({ element: rendered.element, route })
    document.title = rendered.title
    scrollTo(0, 0)
  }

  const routeFor = (): Route | null => parseRoute(new URL(location.href), site.router)

  const navigate = async (route: Route): Promise<void> => {
    history.pushState({ route }, '', serializeRoute(route, site.router))
    await show(route)
  }

  const onPopState = (): void => void show(routeFor())

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

    const route = parseRoute(url, site.router)
    if (route === null) return

    event.preventDefault()
    void navigate(route)
  }

  addEventListener('popstate', onPopState)
  document.addEventListener('click', onClick)

  history.replaceState({ route: routeFor() }, '', location.href)
  await show(routeFor())

  return () => {
    removeEventListener('popstate', onPopState)
    document.removeEventListener('click', onClick)
    cleanup()
    plugins.teardown()
  }
}

import type { ColorScheme, Route } from '@bbg-next/plugin'
import type { WalineInitOptions, WalineInstance } from '@waline/client'
import { definePlugin, injectStyle, readStrings } from '@bbg-next/plugin'
import { init } from '@waline/client'
import walineCss from '@waline/client/style?inline'
import css from './style.css?inline'

// Its own colours, not the theme's: nothing here may depend on what a theme happens to inherit down.
const palette: Record<ColorScheme, string> = {
  light: ':root{--bbg-waline-rule:rgba(0,0,0,0.12)}',
  dark: ':root{--bbg-waline-rule:rgba(255,255,255,0.14)}',
}

/** Ours to set, so they are not forwarded even if the site writes them. */
const reserved = new Set(['routes', 'dark'])

/** Identifies the thread. Built from the route, so hash and path routing agree on it. */
function threadPath(route: Route): string {
  return route.type === 'home' ? '/' : `/${route.type}/${route.slug}`
}

export const setup = definePlugin(({ options, onRendered, onColorScheme }) => {
  injectStyle('bbg-plugin-waline-vendor', walineCss)

  const routes = readStrings(options, 'routes', ['article'])
  const forwarded = Object.fromEntries(Object.entries(options).filter(([key]) => !reserved.has(key)))

  let dark = false
  let instance: WalineInstance | null = null

  onColorScheme(scheme => {
    dark = scheme === 'dark'
    injectStyle('bbg-plugin-waline', palette[scheme] + css)
    // Waline draws its own palette, so it has to be told; its `dark` option is reactive.
    instance?.update({ dark })
  })

  onRendered(({ element, route }) => {
    if (!routes.includes(route.type)) return

    const host = document.createElement('section')
    host.className = 'bbg-waline'
    element.append(host)

    // Options come from data/plugins/waline.json unvalidated; waline reports what it cannot use.
    instance = init({ ...forwarded, dark, el: host, path: threadPath(route) } as WalineInitOptions)

    return () => {
      instance?.destroy()
      instance = null
    }
  })
})

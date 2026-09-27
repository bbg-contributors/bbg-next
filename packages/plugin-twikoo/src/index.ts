import { definePlugin, injectStyle, permalink, threadPath } from '@bbg-next/plugin'
import { init, version } from 'twikoo'
import css from './style.css?inline'

export const setup = definePlugin(({ options, site, onRendered, onColorScheme }) => {
  injectStyle('bbg-plugin-twikoo', css)

  const host = document.createElement('section')
  host.className = 'bbg-twikoo'
  host.setAttribute('data-bbg-plugin', 'twikoo')

  // Twikoo's own dark styles key on this too, and unlike `data-theme` no theme framework does.
  onColorScheme(scheme => {
    host.setAttribute('data-user-color-scheme', scheme)
  })

  // Twikoo fetches languages other than Chinese and English from beside its own script, which here is this bundle.
  const settings = { lang: site.lang, localeBaseUrl: `https://cdn.jsdelivr.net/npm/twikoo@${version}/dist`, ...options }

  // Twikoo can neither close a thread nor switch it, only start again, which replaces the one it showed.
  let path = ''

  onRendered(({ element, route, comments }) => {
    if (!comments) {
      host.remove()
      path = ''

      return
    }

    if (host.parentElement !== element) element.append(host)

    const next = threadPath(route)
    if (next === path) return

    path = next
    // Options come from data/plugins/twikoo.json unvalidated; twikoo reports what it cannot use. Its server links notifications to `href`.
    init({ ...settings, el: host, path, href: permalink(route) }).catch(
      (cause: unknown) => void console.error('bbg-next: twikoo failed to start', cause),
    )
  })
})

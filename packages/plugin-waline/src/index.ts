import type { WalineInitOptions, WalineInstance } from '@waline/client'
import { definePlugin, injectStyle, threadPath } from '@bbg-next/plugin'
import { init } from '@waline/client'
import walineCss from '@waline/client/style?inline'
import css from './style.css?inline'

export const setup = definePlugin(({ options, onRendered, onColorScheme }) => {
  injectStyle('bbg-plugin-waline-vendor', walineCss)
  injectStyle('bbg-plugin-waline', css)

  // Ours to set, so it is not forwarded even if the site writes it.
  const forwarded = Object.fromEntries(Object.entries(options).filter(([key]) => key !== 'dark'))

  const host = document.createElement('section')
  host.className = 'bbg-waline'
  host.setAttribute('data-bbg-plugin', 'waline')

  let dark = false
  let path = ''
  let instance: WalineInstance | null = null

  onColorScheme(scheme => {
    dark = scheme === 'dark'
    // Waline draws its own palette, so it has to be told. Its `update` resets the thread to `location.pathname` unless handed one.
    instance?.update({ dark, path })
  })

  // One thread on screen at a time, carried along into the next view that has one and pointed at its path.
  onRendered(({ element, route, comments }) => {
    if (!comments) {
      instance?.destroy()
      instance = null
      host.remove()

      return
    }

    if (host.parentElement !== element) element.append(host)

    const next = threadPath(route)
    if (instance === null) {
      path = next
      // Options come from data/plugins/waline.json unvalidated; waline reports what it cannot use.
      instance = init({ ...forwarded, dark, el: host, path } as WalineInitOptions)
    } else if (next !== path) {
      path = next
      instance.update({ dark, path })
    }
  })
})

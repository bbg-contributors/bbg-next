import { definePlugin, injectStyle, readString, threadPath, wordFor } from '@bbg-next/plugin'
import css from './style.css?inline'

const trailingSlashes = /\/+$/

// Published only by the server itself, which keeps it in step with the API it calls.
async function load(server: string): Promise<RustalineConstructor> {
  const script = document.createElement('script')
  script.src = `${server}/sdk/rustaline.js`

  await new Promise((resolve, reject) => {
    script.addEventListener('load', resolve, { once: true })
    script.addEventListener('error', () => void reject(new Error(`Cannot load ${script.src}`)), { once: true })
    document.head.append(script)
  })
  if (window.Rustaline === undefined) throw new Error(`${script.src} defines no Rustaline`)

  return window.Rustaline
}

export const setup = definePlugin(({ options, site, onRendered, onColorScheme }) => {
  injectStyle('bbg-plugin-rustaline', css)

  const server = readString(options, 'server', '').replace(trailingSlashes, '')
  // The options are rustaline's own, passed on unvalidated. It speaks only Chinese and English and shows Chinese for any other language, where `auto` follows the reader's browser.
  const settings = {
    lang: wordFor(site.lang, { zh: 'zh-CN', en: 'en' }, 'auto'),
    ...(site.seed === undefined ? {} : { colorPattern: site.seed }),
    ...options,
    server,
  }

  const host = document.createElement('section')
  host.className = 'bbg-rustaline'
  host.setAttribute('data-bbg-plugin', 'rustaline')

  let sdk: Promise<RustalineConstructor> | null = null
  let dark = false
  let path = ''
  let thread: { readonly root: HTMLElement; readonly instance: RustalineInstance } | null = null

  onColorScheme(scheme => {
    dark = scheme === 'dark'
    // Rustaline reads `darkMode` only as it starts, and draws the dark scheme by this class.
    thread?.root.classList.toggle('rs-dark', dark)
  })

  // Rustaline cannot switch threads, and one destroyed still draws into its element as its requests come back, so each thread gets an element of its own.
  function close(): void {
    thread?.instance.destroy()
    thread?.root.remove()
    thread = null
  }

  async function open(url: string): Promise<void> {
    sdk ??= load(server).catch((cause: unknown) => {
      sdk = null
      throw cause
    })
    const Rustaline = await sdk
    // Another thread was asked for while it loaded, or this one has started already.
    if (url !== path || thread !== null) return

    const root = document.createElement('div')
    host.append(root)
    thread = { root, instance: new Rustaline({ ...settings, el: root, url, darkMode: dark ? 'dark' : 'light' }) }
  }

  onRendered(({ element, route, comments }) => {
    if (!comments) {
      close()
      host.remove()
      path = ''

      return
    }

    if (host.parentElement !== element) element.append(host)

    const next = threadPath(route)
    if (next === path) return

    close()
    path = next
    open(next).catch((cause: unknown) => void console.error('bbg-next: rustaline failed to start', cause))
  })
})

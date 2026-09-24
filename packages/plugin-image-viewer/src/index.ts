import { definePlugin, injectStyle, wordFor } from '@bbg-next/plugin'
import css from './style.css?inline'

export const setup = definePlugin(({ site, onRendered }) => {
  injectStyle('bbg-plugin-image-viewer', css)

  const picture = document.createElement('img')
  const caption = document.createElement('figcaption')
  const figure = document.createElement('figure')
  figure.append(picture, caption)

  const original = document.createElement('a')
  original.target = '_blank'
  original.rel = 'noopener'
  original.textContent = wordFor(site.lang, { zh: '在新标签页打开', ja: '新しいタブで開く' }, 'Open in a new tab')

  const dialog = document.createElement('dialog')
  dialog.className = 'bbg-image-viewer'
  // Focusable itself, so opening it lights up no link.
  dialog.tabIndex = -1
  dialog.append(figure, original)
  // Anywhere but the link closes it, the backdrop included.
  dialog.addEventListener('click', event => {
    if (event.target !== original) dialog.close()
  })

  function show(image: HTMLImageElement): void {
    picture.src = image.src
    picture.alt = image.alt
    caption.textContent = image.alt
    caption.hidden = image.alt === ''
    original.href = image.src

    if (!dialog.isConnected) document.body.append(dialog)
    dialog.showModal()
    dialog.focus()
  }

  // Delegated, so a picture that turns up later, out of an encrypted block say, opens all the same.
  const onClick = (event: MouseEvent): void => {
    const image = event.target
    if (image instanceof HTMLImageElement && image.closest('a') === null) show(image)
  }

  let watched: HTMLElement | null = null

  onRendered(({ element, route }) => {
    const next = route.type === 'article' || route.type === 'page' ? element : null
    if (next === watched) return

    watched?.removeEventListener('click', onClick)
    next?.addEventListener('click', onClick)
    watched = next
  })
})

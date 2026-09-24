import { definePlugin, injectStyle, readString } from '@bbg-next/plugin'
import css from './style.css?inline'

export const setup = definePlugin(({ options, onColorScheme }) => {
  injectStyle('bbg-plugin-wallpaper', css)

  const image = document.createElement('img')
  image.className = 'bbg-wallpaper'
  image.alt = ''
  image.setAttribute('aria-hidden', 'true')
  image.decoding = 'async'
  // The API is to be called with no referrer.
  image.referrerPolicy = 'no-referrer'
  image.addEventListener('load', () => void image.classList.add('is-loaded'), { once: true })
  image.addEventListener('error', () => void image.remove(), { once: true })
  // Each request is redirected to a picture of its own, so every visit gets a different one.
  image.src = readString(options, 'api', 'https://api.paugram.com/wallpaper')

  onColorScheme(scheme => void image.setAttribute('data-scheme', scheme))
  document.body.prepend(image)
})

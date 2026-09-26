import { el } from './elements/base.ts'

/** One fixed layer under everything the page draws, softened a little so what sits on it stays easy to read. `url` is absolute, or relative to the site root. */
export function layWallpaper(url: string): void {
  // Scaled up a touch, or the blur would fade its edges into the page's own colour. The palette dims it in the dark, so a bright picture does not glare through a dark page.
  const image = el(
    'img',
    'bbg-wallpaper pointer-events-none fixed inset-0 -z-1 size-full scale-105 object-cover opacity-0 blur-[5px] brightness-(--wallpaper-brightness) transition-opacity duration-600 data-loaded:opacity-100 motion-reduce:transition-none',
  )
  image.alt = ''
  image.setAttribute('aria-hidden', 'true')
  image.decoding = 'async'
  // Hosts that refuse hotlinking mostly let a request with no referrer through.
  image.referrerPolicy = 'no-referrer'
  image.addEventListener('load', () => void image.toggleAttribute('data-loaded', true), { once: true })
  image.addEventListener('error', () => void image.remove(), { once: true })
  image.src = url

  document.body.prepend(image)
}

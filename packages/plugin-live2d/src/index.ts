import { definePlugin } from '@bbg-next/plugin'

export const setup = definePlugin(({ options, site }) => {
  // The old bbg's cut-off: a phone has no corner to spare.
  if (screen.width < 768) return

  import('./widget.ts')
    .then(({ start }) => start(site.lang, options))
    .catch((cause: unknown) => void console.error('bbg-next: live2d failed to start', cause))
})

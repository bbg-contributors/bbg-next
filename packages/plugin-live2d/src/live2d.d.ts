// live2d-widgets types only its unbundled build, which needs Live2D's SDK it does not ship, so this declares what the plugin takes from its browser build.
declare module 'live2d-widgets/dist/waifu-tips.js' {}

interface Window {
  initWidget: (config: Readonly<Record<string, unknown>>) => void
}

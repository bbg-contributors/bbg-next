import { injectStyle, wordFor } from '@bbg-next/plugin'
import cubism2Path from 'live2d-widgets/dist/live2d.min.js?url&no-inline'
import vendorCss from 'live2d-widgets/dist/waifu.css?inline'
import css from './style.css?inline'
import en from './tips/en.json?url&no-inline'
import ja from './tips/ja.json?url&no-inline'
import zh from './tips/zh.json?url&no-inline'
import 'live2d-widgets/dist/waifu-tips.js'

// Live2D lets no one else ship the core that models from Cubism 3 on need.
const cubism5Path = 'https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js'

export function start(lang: string, options: Readonly<Record<string, unknown>>): void {
  injectStyle('bbg-plugin-live2d-vendor', vendorCss)
  injectStyle('bbg-plugin-live2d', css)

  // The options are the widget's own, passed on unvalidated. The tools are the ones the old bbg showed.
  window.initWidget({
    waifuPath: wordFor(lang, { zh, ja }, en),
    cubism2Path,
    cubism5Path,
    tools: ['hitokoto', 'info', 'quit'],
    logLevel: 'warn',
    ...options,
  })
}

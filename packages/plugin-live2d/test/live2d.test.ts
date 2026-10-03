// @vitest-environment happy-dom
import type { PluginContext } from '@bbg-next/plugin'
import cubism2Path from 'live2d-widgets/dist/live2d.min.js?url&no-inline'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setup } from '../src/index.ts'
import ja from '../src/tips/ja.json?url&no-inline'

const initWidget = vi.hoisted(() => vi.fn<(config: Readonly<Record<string, unknown>>) => void>())
// happy-dom draws no WebGL, so this stands in for what the widget's browser build defines.
vi.mock('live2d-widgets/dist/waifu-tips.js', () => {
  window.initWidget = initWidget

  return {}
})

async function start(width: number, options: Readonly<Record<string, unknown>> = {}): Promise<void> {
  vi.stubGlobal('screen', { width })
  // Only what it reads.
  setup({ options, site: { lang: 'ja' } } as unknown as PluginContext)
  // The widget arrives a few promises later.
  await import('../src/widget.ts')
  await new Promise(resolve => setTimeout(resolve))
}

afterEach(() => {
  vi.unstubAllGlobals()
  initWidget.mockClear()
})

describe('live2d', () => {
  it('stays off a phone, as the old bbg did', async () => {
    await start(390)

    expect(initWidget).not.toHaveBeenCalled()
  })

  it('starts the widget with the cores it brings and tips in the site’s language, the site’s options over its own', async () => {
    await start(1280, { cdnPath: 'https://models.test/', tools: ['quit'] })

    expect(initWidget).toHaveBeenCalledExactlyOnceWith({
      waifuPath: ja,
      cubism2Path,
      cubism5Path: 'https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js',
      tools: ['quit'],
      logLevel: 'warn',
      cdnPath: 'https://models.test/',
    })
  })
})

import { fileURLToPath } from 'node:url'
import { mergeConfig } from 'vite'
import { browserBundle } from '../../vite.base.config.ts'

export default mergeConfig(browserBundle(), {
  build: {
    // The widget is GPL, so its licence is installed with it.
    license: { fileName: 'assets/licenses.md' },
    // The widget's own `new Image()` gets one that asks for CORS; the page's stays as it is.
    rolldownOptions: {
      transform: { inject: { Image: [fileURLToPath(new URL('src/image.ts', import.meta.url)), 'CrossOriginImage'] } },
    },
  },
})

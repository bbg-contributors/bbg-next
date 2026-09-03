import { defineConfig } from 'tsdown'

export default defineConfig({
  platform: 'browser',
  noExternal: [/^@bbg-next\//],
  minify: true,
  exports: {
    devExports: true,
  },
})

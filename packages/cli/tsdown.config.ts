import { defineConfig } from 'tsdown'

export default defineConfig({
  exports: {
    bin: { 'bbg-next': './src/index.ts' },
    devExports: true,
  },
})

import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['./src/index.ts', './src/node/index.ts'],
  platform: 'node',
  exports: {
    devExports: true,
  },
})

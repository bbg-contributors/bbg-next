import { defineConfig } from 'vitest/config'
import { vue } from './vite.base.config.ts'

// The Vue theme's SFCs reach vitest through the runtime's contract test.
export default defineConfig({
  plugins: [vue()],
  test: {
    // Each theme's contract test needs a document of its own: a custom element can be defined only once per page.
    isolate: true,
    fsModuleCache: true,
  },
})

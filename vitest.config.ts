import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

// The Vue theme's SFCs reach vitest through the runtime's contract test.
export default defineConfig({
  plugins: [vue()],
})

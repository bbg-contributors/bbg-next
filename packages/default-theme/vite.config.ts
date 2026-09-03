import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    lib: {
      entry: './src/index.ts',
      formats: ['es'],
      // the runtime loads exactly one file per theme
      fileName: () => 'index.js',
    },
    rollupOptions: { external: [] },
    cssCodeSplit: false,
    target: 'es2023',
    minify: true,
    emptyOutDir: true,
  },
})

import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [vue()],
  // lib mode leaves process.env.NODE_ENV for a downstream bundler, but there is none:
  // the browser loads this file as-is, so vue's own checks would throw on `process`
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    lib: {
      entry: './src/index.ts',
      formats: ['es'],
      // the runtime loads exactly one file per theme
      fileName: () => 'index.js',
    },
    // inline everything: a static page cannot resolve a bare specifier
    rollupOptions: { external: [] },
    // register() injects the stylesheet, so there is no .css asset to place
    cssCodeSplit: false,
    target: 'es2023',
    minify: true,
    emptyOutDir: true,
  },
})

import type { PluginOption, UserConfig } from 'vite'
import vuePlugin from '@vitejs/plugin-vue'

/** Keeps template whitespace as HTML does: the formatter writes a line break for a space, which Vue's default drops between two tags. */
export function vue(): PluginOption {
  return vuePlugin({ template: { compilerOptions: { whitespace: 'preserve' } } })
}

// A theme or plugin is fetched straight from a static page, so it must be an ES module with no bare specifiers left to resolve, and no `process` for a bundled Vue to trip over.
export function browserBundle(...plugins: PluginOption[]): UserConfig {
  return {
    plugins,
    // What it splits off is found beside it, whatever path the site is served under.
    base: './',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: {
      lib: {
        entry: './src/index.ts',
        formats: ['es'],
        // the runtime loads index.js
        fileName: () => 'index.js',
      },
      rolldownOptions: {
        output: {
          // Vite keeps an ES library's line breaks and indentation for the bundler it expects to come next; a browser loads these as they are.
          minify: true,
          // Chunks it imports later and files it points at with `?no-inline` (a library inlines any other) go here, for its metadata to list as assets.
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]',
        },
      },
      target: 'es2023',
    },
  }
}

import type { PluginOption, UserConfig } from 'vite'

// A theme or plugin is fetched straight from a static page, so it must be one self-contained ES module: no bare specifiers left to resolve, and no `process` for a bundled Vue to trip over.
export function browserBundle(...plugins: PluginOption[]): UserConfig {
  return {
    plugins,
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: {
      lib: {
        entry: './src/index.ts',
        formats: ['es'],
        // the runtime loads exactly one file per theme or plugin
        fileName: () => 'index.js',
      },
      rollupOptions: { external: [] },
      // register() injects the stylesheet, so there is no .css asset to place
      cssCodeSplit: false,
      target: 'es2023',
      minify: true,
      emptyOutDir: true,
    },
  }
}

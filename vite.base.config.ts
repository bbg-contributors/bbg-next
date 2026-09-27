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
      rolldownOptions: {
        // Vite keeps an ES library's line breaks and indentation for the bundler it expects to come next; a browser loads these as they are.
        output: { minify: true },
      },
      target: 'es2023',
    },
  }
}

import { defineConfig } from 'tsdown'

export default defineConfig({
  platform: 'browser',
  deps: { alwaysBundle: [/^@bbg-next\//] },
  minify: true,
  exports: {
    devExports: true,
    // The theme contract harness, re-added because tsdown drops a subpath it never emitted. Workspace-only: it is source that imports vitest.
    customExports: (exports, { isPublish }) =>
      isPublish ? exports : { ...exports, './testing': './testing/index.ts' },
  },
})

import { defineConfig } from 'tsdown'

export default defineConfig({
  exports: {
    devExports: true,
    // tsdown drops a subpath it never emitted. The in-memory Vfs is for tests across the workspace, never published.
    customExports: (exports, { isPublish }) =>
      isPublish ? exports : { ...exports, './testing': './testing/index.ts' },
  },
})

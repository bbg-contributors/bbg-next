// Apart from schema.ts, so the runtime, which reads these, stays clear of valibot.

/** Supplied by the runtime, depended on like any other. Bump a version when its API changes. */
export const builtinPlugins: Readonly<Record<string, string>> = { markdown: '1.0.0' }

export const defaultExtensions: readonly string[] = ['md']

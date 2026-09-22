import type { PluginIndexEntry } from './schema.ts'

/** Supplied by the runtime, depended on like any other. Bump a version when its API changes. */
export const builtinPlugins: Readonly<Record<string, string>> = { markdown: '1.0.0' }

export const defaultExtensions: readonly string[] = ['md']

export function contentExtensions(plugins: readonly PluginIndexEntry[]): readonly string[] {
  return [...new Set([...defaultExtensions, ...plugins.flatMap(plugin => plugin.extensions)])]
}

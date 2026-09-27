// twikoo ships no types, so this declares just what the plugin calls.
declare module 'twikoo' {
  export const version: string
  export const init: (options: Readonly<Record<string, unknown>>) => Promise<void>
}

// Rustaline's SDK is a script from its own server, with no types, so this declares just what the plugin calls.
interface RustalineInstance {
  readonly destroy: () => void
}

type RustalineConstructor = new (options: Readonly<Record<string, unknown>>) => RustalineInstance

interface Window {
  Rustaline?: RustalineConstructor
}

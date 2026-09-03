import { start } from './boot.ts'

void start().catch((cause: unknown) => {
  // a blank page tells the author nothing
  document.body.textContent = `bbg-next failed to start: ${cause instanceof Error ? cause.message : String(cause)}`
})

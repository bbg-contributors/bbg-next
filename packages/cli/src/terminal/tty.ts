import type { Buffer } from 'node:buffer'
import process from 'node:process'

/** `q`, plus the control codes raw mode swallows: Ctrl+C (ETX) and Ctrl+D (EOT). */
const quitKeys = new Set(['q', 'Q', '\u0003', '\u0004'])

export const interactive = process.stdin.isTTY === true

/**
 * Runs `handler` once: `q` in a terminal, or SIGINT/SIGTERM anywhere. Raw mode stops the tty turning
 * Ctrl+C into SIGINT, must be restored on exit, and may only be entered on a real tty.
 */
export function onQuit(handler: () => void): void {
  const { stdin } = process
  let finished = false

  const restore = (): void => {
    if (!interactive) return
    if (stdin.isRaw) stdin.setRawMode(false)
    stdin.off('data', onData)
    stdin.pause()
  }

  const fire = (): void => {
    if (finished) return
    finished = true
    restore()
    process.off('SIGINT', fire)
    process.off('SIGTERM', fire)
    handler()
  }

  function onData(chunk: Buffer): void {
    if (quitKeys.has(chunk.toString('utf8'))) fire()
  }

  if (interactive) {
    stdin.setRawMode(true)
    stdin.resume()
    stdin.on('data', onData)
  }

  process.on('SIGINT', fire)
  process.on('SIGTERM', fire)
  process.once('exit', restore)
}

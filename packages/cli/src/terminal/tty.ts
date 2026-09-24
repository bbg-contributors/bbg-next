import type { Buffer } from 'node:buffer'
import process from 'node:process'
import { createInterface } from 'node:readline'
import { Writable } from 'node:stream'

/** `q`, plus the control codes raw mode swallows: Ctrl+C (ETX) and Ctrl+D (EOT). */
const quitKeys = new Set(['q', 'Q', '\u0003', '\u0004'])

export const interactive = process.stdin.isTTY === true

/** Runs `handler` once: `q` in a terminal, or SIGINT/SIGTERM anywhere. Raw mode stops the tty turning Ctrl+C into SIGINT, must be restored on exit, and may only be entered on a real tty. */
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

/** Unechoed in a terminal, or a line each from a pipe. Questions go to stderr, leaving stdout to the result. */
export async function askPasswords(questions: readonly string[]): Promise<string[]> {
  const silent = new Writable({ write: (_chunk, _encoding, done) => void done() })
  const lines = createInterface({ input: process.stdin, output: silent, terminal: interactive })
  lines.on('SIGINT', () => process.exit(130))

  // The iterator, not `question`: a pipe hands over every line at once, and `question` drops those nobody is waiting for yet.
  const next = lines[Symbol.asyncIterator]()
  const answers: string[] = []
  try {
    for (const question of questions) {
      if (interactive) process.stderr.write(question)
      const line = await next.next()
      if (line.done === true) throw new Error('The input ran out before every password was given')

      answers.push(line.value)
      if (interactive) process.stderr.write('\n')
    }
  } finally {
    lines.close()
  }

  return answers
}

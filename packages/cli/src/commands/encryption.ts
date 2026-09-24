import { readFile, writeFile } from 'node:fs/promises'
import process from 'node:process'
import { decryptDocument, encryptDocument } from '@bbg-next/core'
import { defineCommand } from 'clerc'
import { style } from '../terminal/report.ts'
import { askPasswords } from '../terminal/tty.ts'

const print = { type: Boolean, description: 'Print the result instead of rewriting the file', default: false } as const

async function deliver(file: string, text: string, printed: boolean, done: string): Promise<void> {
  if (printed) {
    process.stdout.write(text)

    return
  }

  await writeFile(file, text)
  process.stdout.write(`${style.green(done)} ${file}\n`)
}

export const encrypt = defineCommand(
  {
    name: 'encrypt',
    description: 'Put a document behind a password: its body, or all of it when it has no front matter',
    parameters: ['<file>'],
    flags: { print },
  },
  // oxlint-disable-next-line typescript/no-misused-promises -- clerc awaits the handler itself
  async ctx => {
    const { file } = ctx.parameters
    const source = await readFile(file, 'utf8')

    const [password = '', again] = await askPasswords(['Password: ', 'Again: '])
    if (password === '') throw new Error('The password cannot be empty')
    if (password !== again) throw new Error('The two passwords differ')

    await deliver(file, await encryptDocument(source, password), ctx.flags.print, 'encrypted')
  },
)

export const decrypt = defineCommand(
  {
    name: 'decrypt',
    description: 'Open every encrypted block in a document',
    parameters: ['<file>'],
    flags: { print },
  },
  // oxlint-disable-next-line typescript/no-misused-promises -- clerc awaits the handler itself
  async ctx => {
    const { file } = ctx.parameters
    const source = await readFile(file, 'utf8')

    const [password = ''] = await askPasswords(['Password: '])
    const opened = await decryptDocument(source, password)
    if (opened === null) throw new Error('Wrong password')

    await deliver(file, opened, ctx.flags.print, 'decrypted')
  },
)

import createMarkdownIt from 'markdown-it'
import { splitFrontMatter } from './frontmatterSplit.ts'

// Node and browsers both carry WebCrypto and the text codecs as globals. Declared only as far as they are used here, since core takes neither environment's types.
interface AesGcm {
  readonly name: 'AES-GCM'
  readonly iv: Uint8Array
}
declare const crypto: {
  readonly getRandomValues: <T extends Uint8Array>(array: T) => T
  readonly subtle: {
    readonly importKey: (
      format: 'raw',
      key: Uint8Array,
      algorithm: 'PBKDF2',
      extractable: false,
      usages: ['deriveKey'],
    ) => Promise<object>
    readonly deriveKey: (
      algorithm: { name: 'PBKDF2'; salt: Uint8Array; iterations: number; hash: 'SHA-256' },
      base: object,
      derived: { name: 'AES-GCM'; length: 256 },
      extractable: false,
      usages: ['encrypt' | 'decrypt'],
    ) => Promise<object>
    readonly encrypt: (algorithm: AesGcm, key: object, data: Uint8Array) => Promise<ArrayBuffer>
    readonly decrypt: (algorithm: AesGcm, key: object, data: Uint8Array) => Promise<ArrayBuffer>
  }
}
declare const TextEncoder: new () => { encode: (text: string) => Uint8Array }
declare const TextDecoder: new () => { decode: (bytes: ArrayBuffer) => string }

/** The element an encrypted block renders as, and so the name of the fence that holds one. */
export const encryptedElement = 'bbg-encrypted'

const version = 'v1'
/** OWASP's floor for PBKDF2-HMAC-SHA256 as of 2023. A payload records its own count, so raising this strands nothing. */
const iterations = 600_000

const whitespace = /\s+/g
const hexBytes = /^(?:[\da-f]{2})+$/
const byte = /../g

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('')
}

function fromHex(hex: string): Uint8Array | null {
  if (!hexBytes.test(hex)) return null

  return Uint8Array.from(hex.match(byte) ?? [], pair => Number.parseInt(pair, 16))
}

async function deriveKey(
  password: string,
  salt: Uint8Array,
  count: number,
  usage: 'encrypt' | 'decrypt',
): Promise<object> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey'])

  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: count, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    [usage],
  )
}

/** `v1.<iterations>.<salt>.<iv>.<ciphertext>`, the last three in hex. */
export async function encrypt(plaintext: string, password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(password, salt, iterations, 'encrypt')
  const sealed = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext))

  return [version, String(iterations), toHex(salt), toHex(iv), toHex(new Uint8Array(sealed))].join('.')
}

/** `null` for a wrong password, which AES-GCM's tag gives away; a payload that is none at all throws. Whitespace is ignored, so a block may wrap it. */
export async function decrypt(payload: string, password: string): Promise<string | null> {
  const [tag, count, ...hex] = payload.replace(whitespace, '').split('.')
  const [salt, iv, sealed] = hex.map(fromHex)
  const rounds = Number(count)

  if (tag !== version || hex.length !== 3 || !Number.isSafeInteger(rounds) || rounds < 1 || !salt || !iv || !sealed) {
    throw new Error('Not an encrypted block this version of bbg-next can read')
  }

  const key = await deriveKey(password, salt, rounds, 'decrypt')
  let opened: ArrayBuffer
  try {
    opened = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, sealed)
  } catch {
    return null
  }

  return new TextDecoder().decode(opened)
}

const wrapPoint = /.{64}(?=.)/g
const linePrefix = /^[\s>]*/
const trailingNewline = /\n$/

function fence(payload: string): string {
  return `\`\`\`${encryptedElement}\n${payload.replace(wrapPoint, '$&\n')}\n\`\`\`\n`
}

/** The front matter exactly as written, then the body. */
function split(source: string): readonly [head: string, body: string] {
  const { body } = splitFrontMatter(source)

  return [source.slice(0, source.length - body.length), body]
}

/** By the parser's lines, so a block shown inside a code sample is no block. */
function blocks(body: string): readonly { readonly span: readonly [number, number]; readonly payload: string }[] {
  return createMarkdownIt()
    .parse(body, {})
    .flatMap(token =>
      token.type === 'fence' && token.info.trim() === encryptedElement && token.map !== null
        ? [{ span: [token.map[0], token.map[1]] as const, payload: token.content }]
        : [],
    )
}

/** The body goes into one block behind `password`, or the whole document when it has no front matter, which is how to make a block to paste elsewhere. */
export async function encryptDocument(source: string, password: string): Promise<string> {
  const [head, body] = split(source)
  if (blocks(body).length > 0) throw new Error('This already holds an encrypted block; decrypt it first')

  return `${head}${fence(await encrypt(body, password))}`
}

/** Opens every block in place, each indented or quoted the way its fence was. `null` if any refuses `password`. */
export async function decryptDocument(source: string, password: string): Promise<string | null> {
  const [head, body] = split(source)
  const found = blocks(body)
  if (found.length === 0) throw new Error('This holds no encrypted block')

  const lines = body.split('\n')
  // Last first, so the line numbers of those before stay true.
  for (const { span, payload } of found.toReversed()) {
    const plaintext = await decrypt(payload, password)
    if (plaintext === null) return null

    const [start, end] = span
    const prefix = linePrefix.exec(lines[start] ?? '')?.[0] ?? ''
    const opened = plaintext
      .replace(trailingNewline, '')
      .split('\n')
      .map(line => `${prefix}${line}`)
    lines.splice(start, end - start, ...opened)
  }

  return `${head}${lines.join('\n')}`
}

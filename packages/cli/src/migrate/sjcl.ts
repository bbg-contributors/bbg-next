import { Buffer } from 'node:buffer'
import { createDecipheriv, pbkdf2Sync } from 'node:crypto'

// What the old editor's `sjcl.encrypt(password, text)` wrote: PBKDF2-HMAC-SHA256 into AES-CCM, as JSON.

const ciphers = { 128: 'aes-128-ccm', 192: 'aes-192-ccm', 256: 'aes-256-ccm' } as const

export interface SjclPayload {
  readonly iv: string
  readonly salt: string
  readonly ct: string
  readonly iter: number
  readonly ks: keyof typeof ciphers
  /** Tag bits. */
  readonly ts: 64 | 96 | 128
}

/** `null` for anything but a payload this can open. */
export function parseSjcl(text: string): SjclPayload | null {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    return null
  }
  if (typeof value !== 'object' || value === null) return null

  const payload = value as Readonly<Record<string, unknown>>
  const encoded = ['iv', 'salt', 'ct'].every(key => typeof payload[key] === 'string')
  const known =
    payload['mode'] === 'ccm' &&
    payload['cipher'] === 'aes' &&
    (payload['adata'] ?? '') === '' &&
    [128, 192, 256].includes(payload['ks'] as number) &&
    [64, 96, 128].includes(payload['ts'] as number) &&
    Number.isSafeInteger(payload['iter'])

  return encoded && known ? (payload as unknown as SjclPayload) : null
}

/** `null` for a wrong password, which the CCM tag gives away. */
export function openSjcl(payload: SjclPayload, password: string): string | null {
  const iv = Buffer.from(payload.iv, 'base64')
  const ct = Buffer.from(payload.ct, 'base64')
  const tagLength = payload.ts / 8
  const sealed = ct.subarray(0, ct.length - tagLength)

  // sjcl sizes CCM's length field to the message, from two bytes up, and cuts its nonce from the iv to fill the rest of fifteen.
  let lengthBytes = 2
  while (lengthBytes < 4 && sealed.length >>> (8 * lengthBytes) !== 0) lengthBytes += 1

  try {
    const key = pbkdf2Sync(password, Buffer.from(payload.salt, 'base64'), payload.iter, payload.ks / 8, 'sha256')
    const decipher = createDecipheriv(ciphers[payload.ks], key, iv.subarray(0, 15 - lengthBytes), {
      authTagLength: tagLength,
    })
    decipher.setAuthTag(ct.subarray(ct.length - tagLength))

    return Buffer.concat([decipher.update(sealed), decipher.final()]).toString('utf8')
  } catch {
    return null
  }
}

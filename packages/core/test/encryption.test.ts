import { beforeAll, describe, expect, it } from 'vitest'
import { decrypt, decryptDocument, encrypt, encryptDocument } from '../src/content/encryption.ts'
import { deriveExcerpt } from '../src/content/excerpt.ts'
import { stripFrontMatter } from '../src/content/frontmatterSplit.ts'

// Every derivation is a deliberate 600k rounds of PBKDF2, so the tests share what they can.

describe('payloads', () => {
  let payload: string

  beforeAll(async () => {
    payload = await encrypt('# 标题\n\nSecret *text*.\n', 'hunter2')
  })

  it('open with the right password', async () => {
    expect(await decrypt(payload, 'hunter2')).toBe('# 标题\n\nSecret *text*.\n')
  })

  it('come back null for a wrong one', async () => {
    expect(await decrypt(payload, 'hunter3')).toBeNull()
  })

  it('read the same wrapped over lines', async () => {
    expect(await decrypt(payload.replace(/.{10}/g, '$&\n  '), 'hunter2')).toBe('# 标题\n\nSecret *text*.\n')
  })

  it.each(['', 'v2.600000.00.00.00', 'v1.600000.zz.00.00', 'v1.0.00.00.00', 'v1.600000.00.00'])(
    'throw for %j, which is no payload',
    async broken => {
      await expect(decrypt(broken, 'hunter2')).rejects.toThrow(/Not an encrypted block/)
    },
  )
})

describe('documents', () => {
  const article = '---\ntitle: 日记\n# the author’s own comment\n---\n\nDear diary,\n\nnothing happened.\n'
  let locked: string

  beforeAll(async () => {
    locked = await encryptDocument(article, 'hunter2')
  })

  it('keep their front matter as written and the body in one block', () => {
    expect(locked.startsWith('---\ntitle: 日记\n# the author’s own comment\n---\n\n```bbg-encrypted\n')).toBe(true)
    expect(locked).not.toContain('diary')
  })

  it('leave nothing for an excerpt to give away', () => {
    expect(deriveExcerpt(stripFrontMatter(locked))).toBe('')
  })

  it('come back exactly as they were', async () => {
    expect(await decryptDocument(locked, 'hunter2')).toBe(article)
  })

  it('come back null for a wrong password', async () => {
    expect(await decryptDocument(locked, 'hunter3')).toBeNull()
  })

  it('refuse to be locked twice', async () => {
    await expect(encryptDocument(locked, 'hunter2')).rejects.toThrow(/already holds/)
  })

  it('refuse to be opened with no block in them', async () => {
    await expect(decryptDocument(article, 'hunter2')).rejects.toThrow(/no encrypted block/)
  })

  it('open a block pasted into a quote, keeping it quoted', async () => {
    const pasted = (await encryptDocument('one\n\ntwo\n', 'hunter2')).replace(/^/gm, '> ').replace(/> $/, '')
    const opened = await decryptDocument(`Before.\n\n${pasted}\nAfter.\n`, 'hunter2')

    expect(opened).toBe('Before.\n\n> one\n> \n> two\n\nAfter.\n')
  })
})

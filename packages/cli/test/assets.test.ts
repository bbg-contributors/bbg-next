import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { createMemoryVfs } from '@bbg-next/core/testing'
import { afterEach, describe, expect, it } from 'vitest'
import { installPlugin } from '../src/assets.ts'

let built: string | undefined

afterEach(async () => {
  if (built !== undefined) await rm(built, { recursive: true, force: true })
  built = undefined
})

/** A build on disk, as `plugin add` is pointed at. */
async function build(files: Readonly<Record<string, string>>): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'bbg-next-build-'))
  built = dir
  for (const [path, content] of Object.entries(files)) {
    await mkdir(dirname(join(dir, path)), { recursive: true })
    await writeFile(join(dir, path), content)
  }

  return dir
}

// Themes are installed the same way.
describe('a plugin bringing assets', () => {
  const dir = 'bbg/plugins/demo'
  const meta = (assets: readonly string[]) => JSON.stringify({ name: 'demo', version: '1.0.0', assets })

  it('comes with every file it lists, a directory with all it holds, and nothing an earlier version left', async () => {
    const source = await build({
      'index.js': '',
      'plugin.json': meta(['assets', 'font.woff2']),
      'assets/chunk.js': '',
      'assets/deep/style.css': '',
      'font.woff2': '',
      'unlisted.txt': '',
    })
    const vfs = createMemoryVfs({ [`${dir}/assets/old-chunk.js`]: 'stale' })

    await installPlugin(vfs, source, undefined)

    for (const path of ['index.js', 'plugin.json', 'assets/chunk.js', 'assets/deep/style.css', 'font.woff2']) {
      expect(await vfs.exists(`${dir}/${path}`)).toBe(true)
    }
    expect(await vfs.exists(`${dir}/unlisted.txt`)).toBe(false)
    expect(await vfs.exists(`${dir}/assets/old-chunk.js`)).toBe(false)
  })

  it('is refused while a file it lists is missing, and the installed one kept', async () => {
    const source = await build({ 'index.js': '', 'plugin.json': meta(['assets']) })
    const vfs = createMemoryVfs({ [`${dir}/index.js`]: 'working' })

    await expect(installPlugin(vfs, source, undefined)).rejects.toThrow(/lists assets, which is not there/)
    expect(await vfs.readFile(`${dir}/index.js`)).toBe('working')
  })
})

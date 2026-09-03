import type { Vfs } from '@bbg-next/core'
import { access } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runtimePath, themeDir, themePath, themesDir } from '@bbg-next/core'

const themePackages = new Map<string, string>([
  ['default-theme', '@bbg-next/default-theme'],
  ['default-theme-vue', '@bbg-next/default-theme-vue'],
])

export const themeNames = [...themePackages.keys()]
export const defaultTheme = 'default-theme'

// every theme pins index.js as its bundle name
async function bundlePath(packageName: string): Promise<string> {
  const dist = join(dirname(fileURLToPath(import.meta.resolve(`${packageName}/package.json`))), 'dist/index.js')

  try {
    await access(dist)
  } catch {
    throw new Error(
      `${packageName} has not been built yet (looked for ${dist}).\n` +
        'Run `pnpm build` at the repo root first — the runtime and themes ship as prebuilt bundles.',
    )
  }

  return dist
}

/** Copies in the runtime and `theme`, dropping every other theme so a switch leaves nothing behind to ship. */
export async function syncAssets(vfs: Vfs, theme: string): Promise<void> {
  const packageName = themePackages.get(theme)
  if (packageName === undefined) {
    throw new Error(`Unknown theme ${JSON.stringify(theme)}. Available: ${themeNames.join(', ')}`)
  }

  const [runtime, bundle] = await Promise.all([bundlePath('@bbg-next/runtime'), bundlePath(packageName)])

  await vfs.copyIn(runtime, runtimePath)
  await vfs.copyIn(bundle, themePath(theme))

  const keep = themeDir(theme)
  const dirs = (await vfs.list(themesDir)).map(entry => `${themesDir}/${entry}`)

  await Promise.all(dirs.filter(dir => dir !== keep).map(async dir => vfs.remove(dir)))
}

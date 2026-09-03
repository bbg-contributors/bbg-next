import process from 'node:process'
import { createNodeHost } from '@bbg-next/adapter/node'
import { articlesDir, manifestPath, pagesDir, parseSiteSettings, stringifyFrontMatter } from '@bbg-next/core'
import { defineCommand, Types } from 'clerc'
import { defaultTheme, themeNames } from '../assets.ts'
import { syncSite } from '../sync.ts'
import { reportDiagnostics, style } from '../terminal/report.ts'

const sampleArticle = `Welcome to bbg-next.

This file is the source of truth: its front matter carries the metadata, and
\`data/site.json\` is regenerated from it. Edit or delete this file — \`bbg-next preview\`
picks up the change and reloads the browser.

There is no build step. What sits in this directory is exactly what you deploy.
`

const samplePage = `Say something about yourself here.
`

export const init = defineCommand(
  {
    name: 'init',
    description: 'Scaffold a new bbg-next site',
    parameters: ['[dir]'],
    flags: {
      title: { type: String, description: 'Site title', default: 'A new blog' },
      lang: { type: String, description: 'BCP-47 language tag', default: 'zh-CN' },
      router: { type: Types.Enum('hash', 'path'), description: 'Routing mode', default: 'hash' },
      base: { type: String, description: 'Path prefix the site is served under', default: '/' },
      theme: { type: Types.Enum(...themeNames), description: 'Theme to scaffold with', default: defaultTheme },
      force: { type: Boolean, description: 'Overwrite an existing site', default: false },
    },
  },
  // oxlint-disable-next-line typescript/no-misused-promises -- clerc awaits the handler itself
  async ctx => {
    const { dir } = ctx.parameters
    const { base, force, lang, router, theme, title } = ctx.flags

    const { root, vfs } = createNodeHost(dir ?? '.')

    if (!force && (await vfs.exists(manifestPath))) {
      throw new Error(`${root} already contains a bbg-next site. Pass --force to overwrite it.`)
    }

    const site = parseSiteSettings({
      title,
      lang,
      description: 'Hello, World!',
      footer: `©${new Date().getFullYear()} ${title}`,
      theme,
      router: { mode: router, base },
    })

    const now = new Date().toISOString()
    await vfs.writeFile(
      `${articlesDir}/hello.md`,
      stringifyFrontMatter({ title: 'Hello, world', tags: ['bbg-next'], created: now, updated: now }, sampleArticle),
    )
    await vfs.writeFile(`${pagesDir}/about.md`, stringifyFrontMatter({ title: 'About', updated: now }, samplePage))

    const { diagnostics } = await syncSite({ vfs, site, includeDrafts: false })
    reportDiagnostics(diagnostics)

    process.stdout.write(`${style.green('created')} ${root}\n  ${style.dim('next:')} bbg-next preview ${dir ?? '.'}\n`)
  },
)

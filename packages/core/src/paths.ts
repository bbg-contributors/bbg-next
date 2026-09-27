export const dataDir = 'data'
export const articlesDir = `${dataDir}/articles`
export const pagesDir = `${dataDir}/pages`
export const pluginConfigDir = `${dataDir}/plugins`
const themeConfigDir = `${dataDir}/themes`
export const manifestPath = `${dataDir}/site.json`

export const atomPath = 'atom.xml'
export const sitemapPath = 'sitemap.txt'

export const runtimePath = 'bbg/runtime.js'
export const themesDir = 'bbg/themes'
export const pluginsDir = 'bbg/plugins'

// encoded: a theme name must not escape the directory
export function themeDir(name: string): string {
  return `${themesDir}/${encodeURIComponent(name)}`
}

export function themePath(name: string): string {
  return `${themeDir(name)}/index.js`
}

export function themeMetaPath(name: string): string {
  return `${themeDir(name)}/theme.json`
}

export function themeConfigPath(name: string): string {
  return `${themeConfigDir}/${encodeURIComponent(name)}.json`
}

export function pluginDir(name: string): string {
  return `${pluginsDir}/${encodeURIComponent(name)}`
}

export function pluginPath(name: string): string {
  return `${pluginDir(name)}/index.js`
}

export function pluginMetaPath(name: string): string {
  return `${pluginDir(name)}/plugin.json`
}

export function pluginConfigPath(name: string): string {
  return `${pluginConfigDir}/${encodeURIComponent(name)}.json`
}

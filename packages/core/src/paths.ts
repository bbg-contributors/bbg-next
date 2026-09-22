export const dataDir = 'data'
export const articlesDir = `${dataDir}/articles`
export const pagesDir = `${dataDir}/pages`
export const pluginConfigDir = `${dataDir}/plugins`
export const manifestFile = 'site.json'
export const manifestPath = `${dataDir}/${manifestFile}`

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

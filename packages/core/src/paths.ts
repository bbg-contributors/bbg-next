export const dataDir = 'data'
export const articlesDir = `${dataDir}/articles`
export const pagesDir = `${dataDir}/pages`
export const manifestFile = 'site.json'
export const manifestPath = `${dataDir}/${manifestFile}`

export const runtimePath = 'bbg/runtime.js'
export const themesDir = 'bbg/themes'

// encoded: a theme name must not escape the directory
export function themeDir(name: string): string {
  return `${themesDir}/${encodeURIComponent(name)}`
}

export function themePath(name: string): string {
  return `${themeDir(name)}/index.js`
}

import type { ArticleEntry, PageEntry, PluginContext, Route } from '@bbg-next/plugin'
import { definePlugin, readString } from '@bbg-next/plugin'

// The original theme, bbg-contributors/default_theme_src, kept its route in the query of index.html.

const home: Route = { type: 'home', page: 1 }
const extension = /\.[^.]*$/

function decode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

/** A file the site lacks gets the slug sync would give it, for the runtime to report as missing. */
function slugOf(entries: readonly (ArticleEntry | PageEntry)[], file: string): string {
  return entries.find(entry => entry.file === file)?.slug ?? file.replace(extension, '')
}

function internal(query: URLSearchParams, friends: string): Route {
  switch (query.get('function') ?? '') {
    case 'tag':
      return { type: 'tag', tag: query.get('argument') ?? '' }
    case 'archive_and_tags':
      return { type: 'archive' }
    case 'friendbook':
      return friends === '' ? home : { type: 'page', slug: friends }
    default:
      return home
  }
}

/** `null` for an address that is none of the original's. */
function routeFor(query: URLSearchParams, context: PluginContext): Route | null {
  const file = query.get('filename') ?? ''

  switch (query.get('type')) {
    case null:
      return query.has('page_id') ? home : null
    case 'article':
      // Its article links escaped some characters twice.
      return { type: 'article', slug: slugOf([...context.articles, ...context.hidden], decode(file)) }
    case 'page':
      return { type: 'page', slug: slugOf(context.pages, file) }
    case 'internal':
      return internal(query, readString(context.options, 'friends', ''))
    default:
      return home
  }
}

export const setup = definePlugin(context => {
  // `+` stays a plus: the original split its query by hand.
  context.registerRedirect(url => routeFor(new URLSearchParams(url.search.replaceAll('+', '%2B')), context))
})

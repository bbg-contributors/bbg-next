import type { MarkdownApi } from '@bbg-next/plugin'
import { definePlugin, injectStyle, readString, readStrings, wordFor } from '@bbg-next/plugin'
import { createElement, Megaphone } from 'lucide'
import css from './style.css?inline'

// `context.require` rather than a bare `require`, which knip takes for a CommonJS import.
export const setup = definePlugin(context => {
  const { options, site, onRendered } = context
  injectStyle('bbg-plugin-announcement', css)

  // The site's own markdown, so raw HTML stays off here too.
  const html = context.require<MarkdownApi>('markdown').instance.render(readString(options, 'text', ''))
  const heading = wordFor(site.lang, { zh: '网站公告', ja: 'お知らせ' }, 'Announcement')
  const routes = readStrings(options, 'routes', ['home'])

  const title = document.createElement('h2')
  title.append(createElement(Megaphone, { 'aria-hidden': 'true' }), heading)

  const body = document.createElement('div')
  body.innerHTML = html

  const box = document.createElement('aside')
  box.className = 'bbg-announcement'
  box.append(title, body)

  onRendered(({ element, route }) => {
    if (!routes.includes(route.type)) box.remove()
    else if (box.parentElement !== element) element.prepend(box)
  })
})

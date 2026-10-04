import type { Query } from './query.ts'
import type { ArticleEntry } from '@bbg-next/plugin'
import { definePlugin, injectStyle, wordFor } from '@bbg-next/plugin'
import { createElement, Search, X } from 'lucide'
import { around, holds, mark, parseQuery } from './query.ts'
import css from './style.css?inline'

interface Words {
  readonly search: string
  readonly keyword: string
  readonly here: string
  readonly results: string
  readonly nothing: string
  readonly close: string
}

// The original theme's wording, all but `here`, which now covers a page as well as an article.
const zh: Words = {
  search: '在站点内搜索',
  keyword: '关键词',
  here: '在当前页面中',
  results: '搜索结果',
  nothing: '未找到结果',
  close: '关闭',
}

const ja: Words = {
  search: '検索...',
  keyword: 'キーワード',
  here: 'このページ内',
  results: '検索結果',
  nothing: '検索結果はありません',
  close: '閉じる',
}

const en: Words = {
  search: 'Search something...',
  keyword: 'Keyword',
  here: 'On this page',
  results: 'Results',
  nothing: 'Could not find a result',
  close: 'Close',
}

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (className !== undefined) node.className = className

  return node
}

function marked(tag: 'span' | 'strong', className: string, text: string, query: Query): HTMLElement {
  const node = element(tag, className)
  node.append(...mark(text, query))

  return node
}

function section(heading: string, content: Node): HTMLElement {
  const title = element('h3', 'bbg-search-heading')
  title.textContent = heading

  const node = element('section')
  node.append(title, content)

  return node
}

/** The text of the document on screen, less typeset formulas and what a fence's element draws from its source. */
function documentText(): Text[] {
  const content = document.querySelector(':is(bbg-article-view, bbg-page-view) .bbg-content')
  if (content === null) return []

  const walker = document.createTreeWalker(content, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode: node =>
      !(node instanceof Element)
        ? NodeFilter.FILTER_ACCEPT
        : node.matches('math, [data-source]')
          ? NodeFilter.FILTER_REJECT
          : NodeFilter.FILTER_SKIP,
  })
  const nodes: Text[] = []
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) nodes.push(node as Text)

  return nodes
}

/** Selects `[from, to)` of the text `nodes` hold between them, and brings it to the middle of the screen. */
function reveal(nodes: readonly Text[], from: number, to: number): void {
  const range = document.createRange()
  let offset = 0
  for (const node of nodes) {
    const end = offset + node.length
    if (from >= offset && from < end) range.setStart(node, from - offset)
    if (to > offset && to <= end) {
      range.setEnd(node, to - offset)
      break
    }
    offset = end
  }

  const selection = getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)

  const box = range.getBoundingClientRect()
  scrollBy({ top: box.top + box.height / 2 - innerHeight / 2 })
}

export const setup = definePlugin(({ site, articles, href, registerAction }) => {
  injectStyle('bbg-plugin-search', css)
  const t = wordFor(site.lang, { zh, ja }, en)

  const dialog = element('dialog', 'bbg-search')
  dialog.setAttribute('aria-label', t.search)

  const title = element('h2', 'bbg-search-title')
  title.textContent = t.search

  const close = element('button', 'bbg-button bbg-search-close')
  close.type = 'button'
  close.title = t.close
  close.setAttribute('aria-label', t.close)
  close.append(createElement(X, { 'aria-hidden': 'true' }))
  close.addEventListener('click', () => dialog.close())

  const head = element('div', 'bbg-search-head')
  head.append(title, close)

  const input = element('input', 'bbg-search-input')
  input.type = 'search'
  input.placeholder = t.keyword
  input.autofocus = true
  input.autocomplete = 'off'
  input.spellcheck = false
  input.setAttribute('autocapitalize', 'off')
  input.setAttribute('aria-label', t.keyword)

  const results = element('div', 'bbg-search-results')
  const nothing = element('p', 'bbg-search-nothing')
  nothing.textContent = t.nothing

  dialog.append(head, input, results)

  function hitOnPage(query: Query): HTMLButtonElement | null {
    const nodes = documentText()
    const text = nodes.map(node => node.data).join('')
    const hit = holds(query, text) ? query.any.exec(text) : null
    if (hit === null) return null

    const button = element('button', 'bbg-button bbg-search-here')
    button.type = 'button'
    button.append(...mark(around(text, hit.index), query))
    button.addEventListener('click', () => {
      dialog.close()
      reveal(nodes, hit.index, hit.index + hit[0].length)
    })

    return button
  }

  function item(entry: ArticleEntry, query: Query): HTMLLIElement {
    const link = element('a')
    link.href = href({ type: 'article', slug: entry.slug })
    link.append(marked('strong', 'bbg-search-name', entry.title, query))
    if (entry.excerpt !== '') link.append(marked('span', 'bbg-search-excerpt', entry.excerpt, query))
    if (entry.tags.length > 0) {
      link.append(marked('span', 'bbg-search-tags', entry.tags.map(tag => `#${tag}`).join(' '), query))
    }

    const node = element('li')
    node.append(link)

    return node
  }

  function draw(): void {
    const query = parseQuery(input.value)
    if (query === null) {
      results.replaceChildren()

      return
    }

    const shown: Node[] = []
    const here = hitOnPage(query)
    if (here !== null) shown.push(section(t.here, here))

    const found = articles.filter(entry => holds(query, [entry.title, entry.excerpt, ...entry.tags].join('\n')))
    if (found.length > 0) {
      const list = element('ul', 'bbg-search-list')
      list.append(...found.map(entry => item(entry, query)))
      shown.push(section(t.results, list))
    }

    results.replaceChildren(...(shown.length > 0 ? shown : [nothing]))
  }

  function open(): void {
    if (!dialog.isConnected) document.body.append(dialog)
    if (!dialog.open) dialog.showModal()
    input.select()
    draw()
  }

  input.addEventListener('input', draw)
  // On the click itself: following a link to the view already on screen only scrolls there, and renders nothing that could close it.
  dialog.addEventListener('click', event => {
    if (event.target === dialog || (event.target instanceof Element && event.target.closest('a') !== null)) {
      dialog.close()
    }
  })

  document.addEventListener('keydown', event => {
    const shortcut =
      (event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'k'
    if (event.defaultPrevented || !shortcut) return

    event.preventDefault()
    open()
  })

  registerAction({ label: t.search, icon: createElement(Search).outerHTML, run: open })
})

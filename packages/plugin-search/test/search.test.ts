// @vitest-environment happy-dom
import type { ArticleEntry, PluginContext, Route, ShellAction } from '@bbg-next/plugin'
import { beforeAll, describe, expect, it } from 'vitest'
import { setup } from '../src/index.ts'

function article(slug: string, title: string, excerpt: string, tags: string[] = []): ArticleEntry {
  return { slug, file: `${slug}.md`, title, tags, created: 0, updated: 0, pinned: false, excerpt, comments: true }
}

let action: ShellAction | undefined

/** Opens the search from the bar and types `text` into it. */
function search(text: string): HTMLDialogElement {
  action?.run()
  const dialog = document.querySelector<HTMLDialogElement>('dialog.bbg-search')
  const input = dialog?.querySelector('input')
  if (!dialog || !input) throw new Error('no search drawn')

  input.value = text
  input.dispatchEvent(new Event('input'))

  return dialog
}

function titles(text: string): (string | null)[] {
  return [...search(text).querySelectorAll('.bbg-search-name')].map(name => name.textContent)
}

describe('the search', () => {
  beforeAll(() => {
    // Only what it reads.
    const context = {
      site: { lang: 'en' },
      articles: [
        article('vue', 'Vue themes', 'Writing a theme in Vue.', ['前端']),
        article('cpp', 'C++ notes', 'Templates and more.', ['c++']),
        article('markup', 'Markup', '<img src=x onerror=alert(1)> stays text'),
      ],
      href: (route: Route) => (route.type === 'article' ? `#/article/${route.slug}` : '#/'),
      registerAction: (offered: ShellAction) => {
        action = offered
      },
    }
    setup(context as unknown as PluginContext)
  })

  it('finds an article only when every word is in its title, tags or excerpt, whatever the case, each taken literally', () => {
    expect(titles('vue 前端')).toEqual(['Vue themes'])
    expect(titles('VUE 后端')).toEqual([])
    expect(titles('c++')).toEqual(['C++ notes'])
    expect(titles('.*')).toEqual([])
  })

  it('shows the markup an excerpt holds as text', () => {
    const dialog = search('stays')

    expect(dialog.querySelector('img')).toBeNull()
    expect(dialog.querySelector('.bbg-search-excerpt')?.textContent).toBe('<img src=x onerror=alert(1)> stays text')
  })

  it('searches the page on screen in its own words, and selects a hit even across markup', () => {
    const view = document.createElement('bbg-article-view')
    view.innerHTML =
      '<h1>Heading</h1><div class="bbg-content"><p>Some <strong>bo</strong>ld text</p><math><mi>secret</mi></math><bbg-friends data-source="x"><button>Shuffle</button></bbg-friends></div><a rel="next">Next article</a>'
    document.body.append(view)
    const here = (text: string): Element | null => search(text).querySelector('.bbg-search-here')

    for (const unseen of ['Heading', 'secret', 'Shuffle', 'Next']) expect(here(unseen)).toBeNull()

    const dialog = search('bold')
    dialog.querySelector<HTMLButtonElement>('.bbg-search-here')?.click()

    expect(dialog.open).toBe(false)
    expect(getSelection()?.toString()).toBe('bold')
  })

  // Following a link to the view already on screen renders nothing that could close it later.
  it('closes on the click that follows a result', () => {
    const dialog = search('vue')
    dialog.querySelector('a')?.click()

    expect(dialog.open).toBe(false)
  })
})

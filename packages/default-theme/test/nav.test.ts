// @vitest-environment happy-dom
import type { NavLink, ShellModel } from '@bbg-next/view'
import { beforeAll, describe, expect, it } from 'vitest'
import { BbgNav } from '../src/elements/BbgNav.ts'

const about: NavLink = { label: 'About', href: '#/page/about', current: false }

const shell: ShellModel = {
  title: 'Blog',
  description: '',
  footerHtml: '',
  home: { href: '#/', current: true },
  archive: { href: '#/archive', current: false },
  links: [about],
}

beforeAll(() => void customElements.define('bbg-nav', BbgNav))

function bar(model: ShellModel): BbgNav {
  const nav = document.createElement('bbg-nav') as BbgNav
  nav.model = model
  document.body.replaceChildren(nav)

  return nav
}

describe('the bar', () => {
  it('moves only its marks as the reader moves, and is drawn again only when what it shows changes', () => {
    const nav = bar(shell)
    const link = nav.querySelector('.bbg-site-nav a')

    nav.model = { ...shell, home: { ...shell.home, current: false }, links: [{ ...about, current: true }] }
    expect(nav.querySelector('.bbg-site-nav a')).toBe(link)
    expect(link?.getAttribute('aria-current')).toBe('page')

    nav.model = { ...shell, links: [about, { label: 'Friends', href: '#/page/friends', current: false }] }
    expect(nav.querySelectorAll('.bbg-site-nav a')).toHaveLength(2)
  })

  it('folds the menu away once a link in it is chosen', () => {
    const nav = bar(shell)
    nav.querySelector('button')?.click()
    expect(nav.querySelector('[data-open]')).not.toBeNull()

    const link = nav.querySelector('.bbg-site-nav a') as HTMLAnchorElement
    link.click()

    expect(nav.querySelector('[data-open]')).toBeNull()
  })
})

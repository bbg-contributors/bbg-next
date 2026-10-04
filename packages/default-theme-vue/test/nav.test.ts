// @vitest-environment happy-dom
import type { ShellModel } from '@bbg-next/view'
import { expect, it } from 'vitest'
import { defineCustomElement, nextTick } from 'vue'
import BbgNav from '../src/components/BbgNav.vue'

const shell: ShellModel = {
  title: 'Blog',
  description: '',
  footerHtml: '',
  home: { href: '#/', current: true },
  archive: { href: '#/archive', current: false },
  links: [{ label: 'About', href: '#/page/about', current: false }],
  actions: [],
}

it('folds the menu away once a link or an action in it is chosen', async () => {
  let pressed = 0
  customElements.define('bbg-nav', defineCustomElement(BbgNav, { shadowRoot: false }))
  const nav = document.createElement('bbg-nav') as HTMLElement & { model: ShellModel }
  nav.model = { ...shell, actions: [{ label: 'Search', icon: '<svg></svg>', run: () => void (pressed += 1) }] }
  document.body.replaceChildren(nav)
  const [toggle, action] = nav.querySelectorAll('button')

  toggle?.click()
  await nextTick()
  expect(nav.querySelector('[data-open]')).not.toBeNull()
  nav.querySelector<HTMLAnchorElement>('.bbg-site-nav a')?.click()
  await nextTick()
  expect(nav.querySelector('[data-open]')).toBeNull()

  toggle?.click()
  await nextTick()
  action?.click()
  await nextTick()
  expect(nav.querySelector('[data-open]')).toBeNull()
  expect(pressed).toBe(1)
})

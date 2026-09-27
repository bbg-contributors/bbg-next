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
}

it('folds the menu away once a link in it is chosen', async () => {
  customElements.define('bbg-nav', defineCustomElement(BbgNav, { shadowRoot: false }))
  const nav = document.createElement('bbg-nav') as HTMLElement & { model: ShellModel }
  nav.model = shell
  document.body.replaceChildren(nav)

  nav.querySelector('button')?.click()
  await nextTick()
  expect(nav.querySelector('[data-open]')).not.toBeNull()

  nav.querySelector<HTMLAnchorElement>('.bbg-site-nav a')?.click()
  await nextTick()
  expect(nav.querySelector('[data-open]')).toBeNull()
})

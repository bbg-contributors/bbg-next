// @vitest-environment happy-dom
import type { PluginContext } from '@bbg-next/plugin'
import { createMarkdown } from '@bbg-next/core'
import { beforeAll, describe, expect, it } from 'vitest'
import { setup } from '../src/index.ts'

const md = createMarkdown()

beforeAll(() => {
  // Only what it reads.
  setup({ require: () => md } as unknown as PluginContext)
})

function render(source: string): string {
  return md.render(source)
}

describe('a formula', () => {
  it('is held in the element that typesets it, one of its own apart from the text', () => {
    expect(render('Pythagoras: $a^2+b^2=c^2$\n')).toBe(
      '<p>Pythagoras: <bbg-math data-bbg-plugin="math">a^2+b^2=c^2</bbg-math></p>\n',
    )
    expect(render('$$\n\\frac{1}{2}\n$$\n')).toBe(
      '<bbg-math data-bbg-plugin="math" display>\\frac{1}{2}\n</bbg-math>\n',
    )
  })

  it('is no price, and nothing in code', () => {
    expect(render('It costs $5 and $10, or `$x$`.\n')).not.toContain('bbg-math')
  })

  it('is typeset as MathML once on the page', async () => {
    // happy-dom lacks it, and Temml warns of a page without a doctype on reading it; the site's shell has one.
    Object.defineProperty(document, 'compatMode', { value: 'CSS1Compat', configurable: true })
    const element = document.createElement('div')
    element.innerHTML = render('$$\n\\frac{1}{2}\n$$\n')
    document.body.replaceChildren(element)
    await import('../src/typeset.ts')
    await new Promise(resolve => void setTimeout(resolve, 0))

    expect(element.querySelector('bbg-math math mfrac')).not.toBeNull()
  })
})

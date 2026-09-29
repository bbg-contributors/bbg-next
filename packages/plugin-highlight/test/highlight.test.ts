// @vitest-environment happy-dom
import type { ColorScheme, PluginContext } from '@bbg-next/plugin'
import { createMarkdown } from '@bbg-next/core'
import { beforeAll, describe, expect, it } from 'vitest'
import { setup } from '../src/index.ts'

const md = createMarkdown()

beforeAll(() => {
  // Only what it reads.
  const context = {
    require: () => md,
    onColorScheme: (handler: (scheme: ColorScheme) => void) => handler('light'),
  }
  setup(context as unknown as PluginContext)
})

function render(source: string): string {
  return md.render(source)
}

/** Puts rendered markdown on the page, then waits out the fetch of highlight.js and the colouring after it. */
async function show(source: string): Promise<HTMLElement> {
  const element = document.createElement('div')
  element.innerHTML = render(source)
  document.body.replaceChildren(element)
  await import('../src/colour.ts')
  await new Promise(resolve => void setTimeout(resolve, 0))

  return element
}

describe('a code block', () => {
  it('comes wrapped in the element that colours it', () => {
    expect(render('```js\nconst a = 1\n```\n')).toBe(
      '<bbg-highlight data-bbg-plugin="highlight"><pre><code class="language-js">const a = 1\n</code></pre>\n</bbg-highlight>\n',
    )
  })

  it('named after a bbg- element is that element still', () => {
    expect(render('```bbg-friends\nname: B\n```\n')).not.toContain('bbg-highlight')
  })

  it('is coloured by a guess when its fence names none', async () => {
    const element = await show('```\n#include <stdio.h>\nint main(void) { return 0; }\n```\n')

    expect(element.querySelector('code [class^="hljs-"]')).not.toBeNull()
  })

  it('is left as written in a language highlight.js does not know', async () => {
    const element = await show('```nosuchlanguage\nconst a = 1\n```\n')

    expect(element.querySelector('code')?.innerHTML).toBe('const a = 1\n')
  })
})

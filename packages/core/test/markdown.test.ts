import type { RenderContext } from '../src/markdown.ts'
import { describe, expect, it } from 'vitest'
import { createMarkdown, renderMarkdown } from '../src/markdown.ts'

const shared = createMarkdown()

function render(source: string, context: RenderContext = {}): string {
  return renderMarkdown(shared, source, context)
}

describe('renderMarkdown', () => {
  it('does not pass raw HTML through', () => {
    const html = render('<script>alert(1)</script>\n')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('escapes an inline tag instead of emitting it', () => {
    const html = render('A <img src=x onerror=alert(1)> B\n')
    // "onerror" survives as inert text; what matters is that no element is created
    expect(html).not.toMatch(/<img/)
    expect(html).toContain('&lt;img')
  })

  it('resolves relative image paths against the document directory', () => {
    const html = render('![alt](pic.png)\n', { baseUrl: 'data/articles/' })
    expect(html).toContain('src="data/articles/pic.png"')
  })
})

describe('createMarkdown', () => {
  // The reason href resolution is a core rule: a renderer-rule patch would be lost here.
  it('still resolves relative paths when a plugin replaces the image rule', () => {
    const md = createMarkdown()
    md.use(instance => {
      // oxlint-disable-next-line typescript/dot-notation -- an index signature, and noPropertyAccessFromIndexSignature wants brackets
      instance.renderer.rules['image'] = (tokens, idx) => `<figure data-src="${tokens[idx]?.attrGet('src') ?? ''}">`
    })

    const html = renderMarkdown(md, '![alt](pic.png)\n', { baseUrl: 'data/articles/' })
    expect(html).toContain('data-src="data/articles/pic.png"')
  })
})

describe('heading permalinks', () => {
  const article: RenderContext = { baseUrl: 'data/articles/', href: '#/post/hello' }

  it('gives a heading an id and opens it with an empty link to itself', () => {
    expect(render('## Hello, *World*\n', article)).toBe(
      '<h2 id="Hello-World"><a class="bbg-anchor" href="#/post/hello#Hello-World" aria-labelledby="Hello-World"></a>Hello, <em>World</em></h2>\n',
    )
  })

  it('numbers a repeated heading', () => {
    const html = render('# Notes\n\n## Notes\n\n## Notes\n', article)
    expect([...html.matchAll(/ id="([^"]+)"/g)].map(match => match[1])).toEqual(['Notes', 'Notes-2', 'Notes-3'])
  })

  it('keeps CJK in the id, percent-encoding it only in the link', () => {
    const html = render('## 第一节 介绍\n', article)
    expect(html).toContain('id="第一节-介绍"')
    expect(html).toContain(`href="#/post/hello#${encodeURIComponent('第一节-介绍')}"`)
  })

  it('skips a heading with nothing to slug', () => {
    expect(render('## ???\n', article)).toBe('<h2>???</h2>\n')
  })

  // The footer, which has no document to link into.
  it('leaves headings bare without an href', () => {
    expect(render('## Hello\n', { baseUrl: 'data/articles/' })).toBe('<h2>Hello</h2>\n')
  })

  it('points a hand-written fragment link into the document', () => {
    expect(render('[see](#Hello)\n', article)).toContain('href="#/post/hello#Hello"')
  })
})

describe('link targets', () => {
  it.each([
    ['pic.png', 'data/articles/', 'data/articles/pic.png'],
    ['/pic.png', 'data/articles/', '/pic.png'],
    ['https://x/y.png', 'data/articles/', 'https://x/y.png'],
    ['//cdn/y.png', 'data/articles/', '//cdn/y.png'],
    ['?page=2', 'data/articles/', '?page=2'],
    ['#section', 'data/articles/', '#section'],
    ['pic.png', undefined, 'pic.png'],
  ])('%s + %s -> %s', (target, baseUrl, expected) => {
    expect(render(`[x](${target})\n`, baseUrl === undefined ? {} : { baseUrl })).toContain(`href="${expected}"`)
  })

  it('puts a fragment after the document’s href', () => {
    expect(render('[x](#section)\n', { baseUrl: 'data/articles/', href: '/blog/post/hello/' })).toContain(
      'href="/blog/post/hello/#section"',
    )
  })
})

describe('fences named after a bbg- element', () => {
  it('become that element, carrying their content', () => {
    expect(render('```bbg-friends\nname: 小明\n```\n')).toBe('<bbg-friends data-source="name: 小明\n"></bbg-friends>\n')
  })

  it('carry the directory the document resolves its own relative links against', () => {
    expect(render('```bbg-friends\nx\n```\n', { baseUrl: 'data/pages/' })).toBe(
      '<bbg-friends data-source="x\n" data-base="data/pages/"></bbg-friends>\n',
    )
  })

  it('keep their content inert', () => {
    const html = render('```bbg-encrypted\n"><script>alert(1)</script>\n```\n')
    expect(html).not.toContain('<script>')
    expect(html).toContain('data-source="&quot;&gt;&lt;script&gt;')
  })

  it.each(['js', 'bbg-Friends', 'bbg-friends extra'])('leave a %s fence as code', info => {
    expect(render(`\`\`\`${info}\nx\n\`\`\`\n`)).toContain('<pre><code')
  })
})

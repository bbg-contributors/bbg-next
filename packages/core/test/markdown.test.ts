import type { RenderContext } from '../src/markdown.ts'
import { describe, expect, it } from 'vitest'
import { createMarkdown, renderMarkdown, resolveHref } from '../src/markdown.ts'

const shared = createMarkdown()

function render(source: string, context?: RenderContext): string {
  return renderMarkdown(shared, source, context)
}

describe('renderMarkdown', () => {
  it('renders CommonMark', () => {
    expect(render('# Hi\n\nSome *text*.\n')).toContain('<h1>Hi</h1>')
  })

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

  it('resolves relative link targets too', () => {
    const html = render('[a](other.md)\n', { baseUrl: 'data/articles/' })
    expect(html).toContain('href="data/articles/other.md"')
  })

  it('leaves absolute and site-rooted URLs alone', () => {
    const html = render('![a](https://x/y.png)\n![b](/z.png)\n', { baseUrl: 'data/articles/' })
    expect(html).toContain('src="https://x/y.png"')
    expect(html).toContain('src="/z.png"')
  })
})

describe('createMarkdown', () => {
  it('hands out independent instances', () => {
    const one = createMarkdown()
    const other = createMarkdown()

    one.use(md => void md.disable('emphasis'))

    expect(renderMarkdown(one, '*x*\n')).toContain('*x*')
    expect(renderMarkdown(other, '*x*\n')).toContain('<em>x</em>')
  })

  it('keeps raw HTML disabled after a plugin runs', () => {
    const md = createMarkdown()
    md.use(instance => void instance.disable('emphasis'))

    expect(renderMarkdown(md, '<script>alert(1)</script>\n')).toContain('&lt;script&gt;')
  })

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

describe('resolveHref', () => {
  it.each([
    ['pic.png', 'data/articles/', 'data/articles/pic.png'],
    ['sub/pic.png', 'data/articles', 'data/articles/sub/pic.png'],
    ['/pic.png', 'data/articles/', '/pic.png'],
    ['https://x/y.png', 'data/articles/', 'https://x/y.png'],
    ['//cdn/y.png', 'data/articles/', '//cdn/y.png'],
    ['mailto:a@b.c', 'data/articles/', 'mailto:a@b.c'],
    ['#section', 'data/articles/', '#section'],
    ['pic.png', undefined, 'pic.png'],
  ])('%s + %s -> %s', (href, base, expected) => {
    expect(resolveHref(href, base)).toBe(expected)
  })
})

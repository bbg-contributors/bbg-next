import { describe, expect, it } from 'vitest'
import { renderMarkdown, resolveHref } from '../src/markdown.ts'

describe('renderMarkdown', () => {
  it('renders CommonMark', () => {
    expect(renderMarkdown('# Hi\n\nSome *text*.\n')).toContain('<h1>Hi</h1>')
  })

  it('does not pass raw HTML through', () => {
    const html = renderMarkdown('<script>alert(1)</script>\n')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('escapes an inline tag instead of emitting it', () => {
    const html = renderMarkdown('A <img src=x onerror=alert(1)> B\n')
    // "onerror" survives as inert text; what matters is that no element is created
    expect(html).not.toMatch(/<img/)
    expect(html).toContain('&lt;img')
  })

  it('resolves relative image paths against the document directory', () => {
    const html = renderMarkdown('![alt](pic.png)\n', { baseUrl: 'data/articles/' })
    expect(html).toContain('src="data/articles/pic.png"')
  })

  it('leaves absolute and site-rooted URLs alone', () => {
    const html = renderMarkdown('![a](https://x/y.png)\n![b](/z.png)\n', { baseUrl: 'data/articles/' })
    expect(html).toContain('src="https://x/y.png"')
    expect(html).toContain('src="/z.png"')
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

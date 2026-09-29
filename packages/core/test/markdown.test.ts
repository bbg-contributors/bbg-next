import type { RenderContext } from '../src/markdown.ts'
import { describe, expect, it } from 'vitest'
import { createMarkdown } from '../src/markdown.ts'
import { serialize } from '../src/route.ts'

const shared = createMarkdown()

function render(source: string, context: RenderContext = {}): string {
  return shared.render(source, context)
}

describe('rendering', () => {
  it('lets no raw HTML through, as a block or inline', () => {
    const html = render('<script>alert(1)</script>\n\nA <img src=x onerror=alert(1)> B\n')

    expect(html).not.toMatch(/<script|<img/)
    expect(html).toContain('&lt;script&gt;')
  })

  // The reason href resolution is a core rule: a renderer-rule patch would be lost here.
  it('still resolves relative paths when a plugin replaces the image rule', () => {
    const md = createMarkdown()
    md.use(instance => {
      // oxlint-disable-next-line typescript/dot-notation -- an index signature, and noPropertyAccessFromIndexSignature wants brackets
      instance.renderer.rules['image'] = (tokens, idx) => `<figure data-src="${tokens[idx]?.attrGet('src') ?? ''}">`
    })

    expect(md.render('![alt](pic.png)\n', { baseUrl: 'data/articles/' })).toContain('data-src="data/articles/pic.png"')
  })

  it('opens a task with a box no one can tick, ticked where done', () => {
    const html = render('- [ ] todo\n- [x] done\n- plain\n')

    expect(html).toContain('<ul class="bbg-task-list">')
    expect(html).toMatch(/<li class="bbg-task"><input [^>]*class="bbg-task-checkbox"[^>]*disabled[^>]*> todo<\/li>/)
    expect(html).toMatch(/<li class="bbg-task"><input [^>]*checked[^>]*> done<\/li>/)
    expect(html).toContain('<li>plain</li>')
  })
})

describe('heading permalinks', () => {
  const article: RenderContext = { baseUrl: 'data/articles/', href: '#/article/hello' }

  it('give a heading an id and open it with an empty link to itself', () => {
    expect(render('## Hello, *World*\n', article)).toBe(
      '<h2 id="Hello-World"><a class="bbg-anchor" href="#/article/hello#Hello-World" aria-labelledby="Hello-World"></a>Hello, <em>World</em></h2>\n',
    )
  })

  it('number a repeated heading', () => {
    const html = render('# Notes\n\n## Notes\n\n## Notes\n', article)

    expect([...html.matchAll(/ id="([^"]+)"/g)].map(match => match[1])).toEqual(['Notes', 'Notes-2', 'Notes-3'])
  })

  it('keep CJK in the id, percent-encoding it only in the link', () => {
    const html = render('## 第一节 介绍\n', article)

    expect(html).toContain('id="第一节-介绍"')
    expect(html).toContain(`href="#/article/hello#${encodeURIComponent('第一节-介绍')}"`)
  })
})

describe('link targets', () => {
  it('resolve against the document’s directory when relative, and stay as written otherwise', () => {
    const hrefs = ['pic.png', '/pic.png', 'https://x/y.png', '//cdn/y.png', '?page=2'].map(
      target => /href="([^"]*)"/.exec(render(`[x](${target})\n`, { baseUrl: 'data/articles/' }))?.[1],
    )

    expect(hrefs).toEqual(['data/articles/pic.png', '/pic.png', 'https://x/y.png', '//cdn/y.png', '?page=2'])
  })

  it('put a fragment after the document’s href', () => {
    expect(render('[x](#section)\n', { baseUrl: 'data/articles/', href: '/blog/article/hello/' })).toContain(
      'href="/blog/article/hello/#section"',
    )
  })
})

describe('a link to #/…', () => {
  // As a feed writes a hash-routed site's views, in full.
  const hashRouted = createMarkdown(
    (route, fragment) => `https://example.com/${serialize(route, { mode: 'hash', base: '/' }, fragment)}`,
  )

  it.each([
    ['#/article/other#Part', 'https://example.com/#/article/other#Part'],
    // off the route grammar, so no view
    ['#/nowhere/at/all', '#/nowhere/at/all'],
  ])('%s is the view at %s on a site routed by hash', (target, expected) => {
    expect(hashRouted.render(`[x](${target})\n`, { href: '#/article/hello' })).toContain(`href="${expected}"`)
  })

  it('is a place in the document on a site routed by path, as any other fragment is', () => {
    expect(render('[x](#/article/other)\n', { href: '/blog/article/hello/' })).toContain(
      'href="/blog/article/hello/#/article/other"',
    )
  })
})

describe('fences named after a bbg- element', () => {
  it('become that element, carrying their content and the directory the document resolves its links against', () => {
    expect(render('```bbg-friends\nname: 小明\n```\n', { baseUrl: 'data/pages/' })).toBe(
      '<bbg-friends data-source="name: 小明\n" data-base="data/pages/"></bbg-friends>\n',
    )
  })

  it('keep their content inert', () => {
    const html = render('```bbg-encrypted\n"><script>alert(1)</script>\n```\n')

    expect(html).not.toContain('<script>')
    expect(html).toContain('data-source="&quot;&gt;&lt;script&gt;')
  })

  it('stay code unless their info string is the element’s name and nothing else', () => {
    for (const info of ['bbg-Friends', 'bbg-friends extra'])
      expect(render(`\`\`\`${info}\nx\n\`\`\`\n`)).toContain('<pre><code')
  })
})

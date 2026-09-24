import type { ArchiveModel, ArticleCard, ArticleListModel, ArticleModel, PageModel, ShellModel } from '@bbg-next/view'
import { defineTheme } from '@bbg-next/view'

// The least a theme can be and still pass the contract.

abstract class ModelElement<Model> extends HTMLElement {
  #model: Model | undefined
  readonly #own = document.createElement('div')

  set model(value: Model) {
    this.#model = value
    // The runtime assigns the model before inserting the element.
    if (this.isConnected) this.update(value)
  }

  get model(): Model | undefined {
    return this.#model
  }

  connectedCallback(): void {
    if (this.#model !== undefined) this.update(this.#model)
  }

  protected abstract update(model: Model): void

  /** Into a box of its own, so what plugins put beside it stays. */
  protected draw(...nodes: Node[]): void {
    if (!this.contains(this.#own)) this.append(this.#own)
    this.#own.replaceChildren(...nodes)
  }
}

function el(tag: string, className?: string, text?: string): HTMLElement {
  const node = document.createElement(tag)
  if (className !== undefined) node.className = className
  if (text !== undefined) node.textContent = text

  return node
}

function link(href: string, text: string): HTMLAnchorElement {
  const anchor = document.createElement('a')
  anchor.href = href
  anchor.textContent = text

  return anchor
}

function titleLink(card: ArticleCard): HTMLElement {
  const title = el('h2', 'bbg-card-title')
  title.append(link(card.href, card.title))

  return title
}

function content(html: string): HTMLElement {
  const node = el('div', 'bbg-content')
  node.innerHTML = html

  return node
}

// The shell stays on screen, so after the first model only the marks move.
class StubNav extends ModelElement<ShellModel> {
  protected override update(model: ShellModel): void {
    if (!this.hasChildNodes()) {
      const links = el('nav', 'bbg-site-nav')
      for (const item of model.links) links.append(link(item.href, item.label))
      this.append(link(model.home.href, model.title), link(model.archive.href, 'Archive'), links)
    }

    const marks = [model.home, model.archive, ...model.links]
    for (const [index, anchor] of this.querySelectorAll('a').entries()) {
      if (marks[index]?.current === true) anchor.setAttribute('aria-current', 'page')
      else anchor.removeAttribute('aria-current')
    }
  }
}

class StubFooter extends ModelElement<ShellModel> {
  #html: string | undefined

  protected override update(model: ShellModel): void {
    if (model.footerHtml === this.#html) return
    this.#html = model.footerHtml

    const footer = el('footer')
    footer.innerHTML = model.footerHtml
    this.replaceChildren(footer)
  }
}

class StubArticleList extends ModelElement<ArticleListModel> {
  protected override update(model: ArticleListModel): void {
    const cards = model.articles.map(card => {
      const item = el('article', 'bbg-card')
      item.append(titleLink(card), el('p', undefined, card.excerpt))
      for (const tag of card.tags) item.append(link(tag.href, `#${tag.name}`))

      return item
    })

    const pagination = el('nav', 'bbg-pagination')
    pagination.append(...model.pageLinks.map(page => link(page.href, String(page.page))))

    this.draw(...cards, pagination)
  }
}

class StubArchiveView extends ModelElement<ArchiveModel> {
  protected override update(model: ArchiveModel): void {
    this.draw(el('h1', undefined, model.tag === null ? 'Archive' : `#${model.tag}`), ...model.articles.map(titleLink))
  }
}

class StubArticleView extends ModelElement<ArticleModel> {
  protected override update(model: ArticleModel): void {
    const parts = [el('h1', undefined, model.title)]
    if (model.unlisted) parts.push(el('p', 'bbg-unlisted', 'Unlisted'))

    this.draw(...parts, content(model.html))
  }
}

class StubPageView extends ModelElement<PageModel> {
  protected override update(model: PageModel): void {
    this.draw(el('h1', undefined, model.title), content(model.html))
  }
}

export function register(): void {
  defineTheme('bbg-stub-theme', '', {
    header: StubNav,
    footer: StubFooter,
    articleList: StubArticleList,
    archive: StubArchiveView,
    article: StubArticleView,
    page: StubPageView,
  })
}

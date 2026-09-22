import type { ArticleListModel, ArticleModel, PageModel, ShellModel } from '@bbg-next/view'
import { defineTheme } from '@bbg-next/view'

// The least a theme can be and still pass the contract.

abstract class ModelElement<Model> extends HTMLElement {
  #model: Model | undefined

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

function content(html: string): HTMLElement {
  const node = el('div', 'bbg-content')
  node.innerHTML = html

  return node
}

class StubNav extends ModelElement<ShellModel> {
  protected override update(model: ShellModel): void {
    const links = el('nav', 'bbg-site-nav')
    links.append(...model.links.map(item => link(item.href, item.label)))

    this.replaceChildren(link(model.homeHref, model.title), links)
  }
}

class StubFooter extends ModelElement<ShellModel> {
  protected override update(model: ShellModel): void {
    const footer = el('footer')
    footer.innerHTML = model.footerHtml

    this.replaceChildren(footer)
  }
}

class StubArticleList extends ModelElement<ArticleListModel> {
  protected override update(model: ArticleListModel): void {
    const cards = model.articles.map(card => {
      const title = el('h2', 'bbg-card-title')
      title.append(link(card.href, card.title))

      const item = el('article', 'bbg-card')
      item.append(title, el('p', undefined, card.excerpt))

      return item
    })

    const pagination = el('nav', 'bbg-pagination')
    pagination.append(...model.pageLinks.map(page => link(page.href, String(page.page))))

    this.replaceChildren(...cards, pagination)
  }
}

class StubArticleView extends ModelElement<ArticleModel> {
  protected override update(model: ArticleModel): void {
    const parts = [el('h1', undefined, model.title)]
    if (model.unlisted) parts.push(el('p', 'bbg-unlisted', 'Unlisted'))

    this.replaceChildren(...parts, content(model.html))
  }
}

class StubPageView extends ModelElement<PageModel> {
  protected override update(model: PageModel): void {
    this.replaceChildren(el('h1', undefined, model.title), content(model.html))
  }
}

export const register = defineTheme('bbg-stub-theme', '', {
  header: StubNav,
  footer: StubFooter,
  articleList: StubArticleList,
  article: StubArticleView,
  page: StubPageView,
})

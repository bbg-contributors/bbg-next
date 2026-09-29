import { injectStyle } from '@bbg-next/plugin'
import temml from 'temml'
import css from 'temml/dist/Temml-Local.css?raw'
import font from 'temml/dist/Temml.woff2?no-inline'

// Temml's own sheet, for the maths fonts a reader has. Its one font of its own comes as a file beside the plugin.
injectStyle('bbg-plugin-math-temml', css.replace("url('Temml.woff2')", `url('${font}')`))

export function typeset(element: HTMLElement): void {
  element.innerHTML = temml.renderToString(element.textContent ?? '', { displayMode: element.hasAttribute('display') })
}

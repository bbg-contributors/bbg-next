import type { Labels } from '../labels.ts'
import type { ColorSchemeControl, ColorSchemePreference, ThemeContext } from '@bbg-next/view'
import { ChevronUp, Moon, Settings, X } from 'lucide'
import { labels } from '../labels.ts'
import { el, icon, iconButton } from './base.ts'

function parseScheme(value: string): ColorSchemePreference {
  return value === 'light' || value === 'dark' ? value : 'auto'
}

function schemeField(colorScheme: ColorSchemeControl, t: Labels): HTMLElement {
  const choices: readonly (readonly [ColorSchemePreference, string])[] = [
    ['auto', t.followSystem],
    ['light', t.light],
    ['dark', t.dark],
  ]

  const select = el('select', 'mt-2 block w-full form-select rounded border-line bg-surface py-1.5 pr-9 pl-3 text-fg')
  for (const [value, label] of choices) {
    const option = el('option', undefined, label)
    option.value = value
    select.append(option)
  }

  select.value = colorScheme.preference()
  select.addEventListener('change', () => void colorScheme.set(parseScheme(select.value)))

  const heading = el('span', 'fs-4 font-medium')
  heading.append(icon(Moon), ` ${t.darkMode}`)

  const field = el('label', 'block')
  field.append(heading, select)

  return field
}

function settingsDialog(context: ThemeContext, t: Labels): HTMLDialogElement {
  // Placed the way a Bootstrap modal sits, which also puts back the margins preflight takes off a native dialog.
  const dialog = el(
    'dialog',
    'mx-auto mt-7 w-[calc(100%-1rem)] max-w-[500px] rounded-[.3rem] bg-surface text-fg shadow-card outline-none backdrop:bg-black/50',
  )
  // Focusable itself, so opening it can focus the dialog as Bootstrap's modal does, rather than light up its first control.
  dialog.tabIndex = -1

  const title = el('h5', 'text-xl font-medium')
  title.append(icon(Settings), ` ${t.settings}`)

  const head = el('div', 'flex items-center justify-between border-b border-line p-4')
  head.append(
    title,
    // Padded as Bootstrap pads a modal's close button, for a shape the ripple can fill without growing the header.
    iconButton(
      '-m-2 grid cursor-pointer place-items-center rounded p-2 text-xl opacity-50 hover:opacity-75',
      t.close,
      X,
      () => dialog.close(),
    ),
  )

  const body = el('div', 'p-4')
  body.append(schemeField(context.colorScheme, t))

  dialog.append(head, body)

  return dialog
}

const tool =
  'grid size-9.5 cursor-pointer place-items-center rounded border border-control bg-control text-on-control transition-colors hover:border-control-hover hover:bg-control-hover'

/** The floating controls and the panel they open, anchored to the viewport rather than to a view. */
export function tools(context: ThemeContext): DocumentFragment {
  const t = labels()
  const dialog = settingsDialog(context, t)

  const bar = el('div', 'fixed right-5 bottom-7.5 z-10 flex flex-col gap-3')
  bar.append(
    iconButton(tool, t.settings, Settings, () => {
      dialog.showModal()
      dialog.focus()
    }),
    // Left to the stylesheet's `scroll-behavior`, which glides only for a reader who has not asked for less motion.
    iconButton(tool, t.backToTop, ChevronUp, () => scrollTo({ top: 0 })),
  )

  const fragment = document.createDocumentFragment()
  fragment.append(dialog, bar)

  return fragment
}

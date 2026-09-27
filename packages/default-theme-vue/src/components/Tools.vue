<script setup lang="ts">
import type { ColorSchemeControl, ColorSchemePreference } from '@bbg-next/view'
import { labels } from '@bbg-next/default-theme-shared'
import { ChevronUp, Moon, Settings, X } from '@lucide/vue'
import { ref, useTemplateRef, watch } from 'vue'
import Icon from './Icon.vue'
import IconButton from './IconButton.vue'

const { colorScheme } = defineProps<{ colorScheme: ColorSchemeControl }>()
const t = labels()
const dialog = useTemplateRef('dialog')

const choices: readonly (readonly [ColorSchemePreference, string])[] = [
  ['auto', t.followSystem],
  ['light', t.light],
  ['dark', t.dark],
]
const preference = ref(colorScheme.preference())
watch(preference, next => void colorScheme.set(next))

const tool =
  'grid size-9.5 cursor-pointer place-items-center rounded border border-control bg-control text-on-control transition-colors hover:border-control-hover hover:bg-control-hover'

// Focus goes to the dialog itself, as with Bootstrap's modal, not to its first control.
function openSettings(): void {
  dialog.value?.showModal()
  dialog.value?.focus()
}

// No `behavior`: the stylesheet's `scroll-behavior` glides only when the reader allows motion.
function backToTop(): void {
  scrollTo({ top: 0 })
}
</script>

<template>
  <!-- Preflight strips a dialog's margins; these put it where a Bootstrap modal sits. -->
  <dialog
    ref="dialog"
    tabindex="-1"
    class="mx-auto mt-7 w-[calc(100%-1rem)] max-w-[500px] rounded-[.3rem] bg-surface text-fg shadow-card outline-none backdrop:bg-black/50"
  >
    <div class="flex items-center justify-between border-b border-line p-4">
      <h5 class="text-xl font-medium"><Icon :icon="Settings" /> {{ t.settings }}</h5>
      <!-- Padded for the ripple, with a negative margin so the header does not grow. -->
      <IconButton
        class="-m-2 grid cursor-pointer place-items-center rounded p-2 text-xl opacity-50 hover:opacity-75"
        :label="t.close"
        :icon="X"
        @click="dialog?.close()"
      />
    </div>
    <div class="p-4">
      <label class="block">
        <span class="fs-4 font-medium"><Icon :icon="Moon" /> {{ t.darkMode }}</span>
        <select
          v-model="preference"
          class="mt-2 block w-full form-select rounded border-line bg-surface py-1.5 pr-9 pl-3 text-fg"
        >
          <option v-for="[value, label] of choices" :key="value" :value="value">{{ label }}</option>
        </select>
      </label>
    </div>
  </dialog>
  <div class="fixed right-5 bottom-7.5 z-10 flex flex-col gap-3">
    <IconButton :class="tool" :label="t.settings" :icon="Settings" @click="openSettings" />
    <IconButton :class="tool" :label="t.backToTop" :icon="ChevronUp" @click="backToTop" />
  </div>
</template>

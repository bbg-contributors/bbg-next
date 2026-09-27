import type { ShallowRef } from 'vue'
import { enter } from '@bbg-next/default-theme-shared'
import { onMounted, watch } from 'vue'

export function useEntrance(target: Readonly<ShallowRef<HTMLElement | null>>, content: () => unknown): void {
  const play = (): void => {
    if (target.value !== null) enter(target.value)
  }

  onMounted(play)
  watch(content, play, { flush: 'post' })
}

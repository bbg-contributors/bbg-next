<script setup lang="ts">
import type { LucideIcon } from '@lucide/vue'
import Icon from './Icon.vue'

const { level = 'h2' } = defineProps<{ icon: LucideIcon; level?: 'h2' | 'h3' }>()
</script>

<template>
  <component :is="level" class="mb-2 leading-[1.2] font-medium" :class="level === 'h2' ? 'fs-2' : 'fs-3'"
    ><Icon :icon="icon" /> <slot
  /></component>
</template>

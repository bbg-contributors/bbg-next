<script setup lang="ts">
import type { LucideIcon } from '@lucide/vue'
import { formatDate, labels } from '@bbg-next/default-theme-shared'
import { computed } from 'vue'
import Icon from './Icon.vue'

const props = defineProps<{ icon: LucideIcon; label: string; at: number; dotted?: boolean }>()
const t = labels()
const iso = computed(() => new Date(props.at).toISOString())
</script>

<template>
  <span
    ><Icon :icon="icon" /> {{ label }}
    <time :class="{ 'border-b border-dashed border-dash': dotted }" :datetime="iso" :title="iso">{{
      formatDate(at, t.month)
    }}</time></span
  >
</template>

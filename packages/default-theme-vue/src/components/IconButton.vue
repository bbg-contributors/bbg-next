<script setup lang="ts">
import type { LucideIcon } from '@lucide/vue'
import Icon from './Icon.vue'

defineProps<{ label: string; icon: LucideIcon }>()
</script>

<template>
  <button type="button" class="ripple" :title="label" :aria-label="label"><Icon :icon="icon" /></button>
</template>

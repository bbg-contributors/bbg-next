<script setup lang="ts">
import type { LucideIcon } from '@lucide/vue'

defineProps<{ icon: LucideIcon }>()
</script>

<template>
  <component :is="icon" class="inline-block shrink-0 align-[-0.125em]" width="1em" height="1em" />
</template>

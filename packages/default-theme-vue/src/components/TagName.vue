<script setup lang="ts">
import { tagColor } from '@bbg-next/default-theme-shared'

defineProps<{ name: string }>()
</script>

<template>
  <span :style="{ color: tagColor(name) }">#{{ name }}</span>
</template>

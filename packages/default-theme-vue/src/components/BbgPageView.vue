<script setup lang="ts">
import type { PageModel } from '@bbg-next/view'

defineProps<{ model: PageModel }>()
</script>

<template>
  <h1 class="bbg-page-title">{{ model.title }}</h1>
  <!-- runtime-rendered, raw HTML disabled -->
  <div class="bbg-content" v-html="model.html" />
</template>

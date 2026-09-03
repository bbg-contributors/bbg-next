<script setup lang="ts">
import type { ShellModel } from '@bbg-next/view'

defineProps<{ model: ShellModel }>()
</script>

<template>
  <!-- runtime-rendered, raw HTML disabled -->
  <footer v-if="model.footerHtml !== ''" class="bbg-site-footer" v-html="model.footerHtml" />
</template>

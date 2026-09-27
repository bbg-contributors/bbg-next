<script setup lang="ts">
import type { ShellModel } from '@bbg-next/view'

defineProps<{ model: ShellModel }>()
</script>

<template>
  <div class="column" :hidden="model.footerHtml === ''">
    <!-- runtime-rendered, raw HTML disabled -->
    <footer
      class="border-t border-fg/5 pt-4 pb-8 text-muted [&_a]:text-accent [&_a]:underline"
      v-html="model.footerHtml"
    />
  </div>
</template>

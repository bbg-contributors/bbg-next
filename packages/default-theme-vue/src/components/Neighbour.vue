<script setup lang="ts">
import type { ArticleLink } from '@bbg-next/view'
import { labels } from '@bbg-next/default-theme-shared'

defineProps<{ side: ArticleLink | null; rel: 'prev' | 'next' }>()
const t = labels()
</script>

<template>
  <div class="rounded-md bg-surface p-4 shadow-card" :class="{ 'text-right': rel === 'next' }">
    <div class="mb-2 text-sm font-medium text-muted"><slot /></div>
    <div class="text-xl font-medium">
      <a v-if="side !== null" class="text-accent underline hover:text-accent-hover" :href="side.href" :rel="rel">{{
        side.title
      }}</a>
      <template v-else>{{ t.nothing }}</template>
    </div>
  </div>
</template>

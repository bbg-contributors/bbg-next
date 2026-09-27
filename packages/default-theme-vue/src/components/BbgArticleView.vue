<script setup lang="ts">
import type { ArticleModel } from '@bbg-next/view'
import { labels } from '@bbg-next/default-theme-shared'
import { useTemplateRef } from 'vue'
import { useEntrance } from '../entrance.ts'
import Banner from './Banner.vue'
import MetaRow from './MetaRow.vue'

const props = defineProps<{ model: ArticleModel }>()
const t = labels()
useEntrance(useTemplateRef('main'), () => props.model.html)
</script>

<template>
  <Banner :title="model.title">
    <span
      v-if="model.unlisted"
      class="bbg-unlisted mb-2 inline-block rounded border border-dashed border-current px-2 text-xs text-muted"
      >{{ t.unlisted }}</span
    >
    <MetaRow :card="model" />
  </Banner>
  <main ref="main">
    <!-- runtime-rendered, raw HTML disabled -->
    <div class="bbg-content my-7.5 rounded-md bg-surface px-[4%] py-7.5 shadow-card" v-html="model.html" />
  </main>
</template>

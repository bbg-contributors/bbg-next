<script setup lang="ts">
import type { ArticleModel } from '@bbg-next/view'
import BbgMeta from './BbgMeta.vue'

defineProps<{ model: ArticleModel }>()
</script>

<template>
  <h1 class="bbg-article-title">{{ model.title }}</h1>
  <BbgMeta :created="model.created" :tags="model.tags" :pinned="false" />
  <p v-if="model.unlisted"><span class="bbg-unlisted">Unlisted</span></p>
  <!-- runtime-rendered, raw HTML disabled -->
  <div class="bbg-content" v-html="model.html" />
</template>

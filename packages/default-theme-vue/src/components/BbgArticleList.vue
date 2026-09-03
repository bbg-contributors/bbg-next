<script setup lang="ts">
import type { ArticleListModel } from '@bbg-next/view'
import BbgMeta from './BbgMeta.vue'

defineProps<{ model: ArticleListModel }>()
</script>

<template>
  <p v-if="model.articles.length === 0" class="bbg-empty">No articles yet.</p>

  <article v-for="card of model.articles" :key="card.slug" class="bbg-card">
    <h2 class="bbg-card-title">
      <a :href="card.href">{{ card.title }}</a>
    </h2>
    <BbgMeta :created="card.created" :tags="card.tags" :pinned="card.pinned" />
    <p v-if="card.excerpt !== ''" class="bbg-card-excerpt">{{ card.excerpt }}</p>
  </article>

  <nav v-if="model.totalPages > 1" class="bbg-pagination">
    <a
      v-for="page of model.pageLinks"
      :key="page.page"
      :href="page.href"
      :aria-current="page.current ? 'page' : undefined"
      >{{ page.page }}</a
    >
  </nav>
</template>

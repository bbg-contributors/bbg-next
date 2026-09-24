<script setup lang="ts">
import type { ArchiveModel, ArticleCard } from '@bbg-next/view'
import { computed } from 'vue'
import BbgMeta from './BbgMeta.vue'

const props = defineProps<{ model: ArchiveModel }>()

const years = computed(() => {
  const groups = new Map<number, ArticleCard[]>()
  for (const card of props.model.articles) {
    const year = new Date(card.created).getFullYear()
    groups.set(year, [...(groups.get(year) ?? []), card])
  }

  return [...groups]
})
</script>

<template>
  <h1 class="bbg-archive-title">{{ model.tag === null ? 'Archive' : `#${model.tag}` }}</h1>

  <section v-for="[year, cards] of years" :key="year">
    <h2 class="bbg-archive-year">{{ year }}</h2>
    <article v-for="card of cards" :key="card.slug" class="bbg-card">
      <h3 class="bbg-card-title">
        <a :href="card.href">{{ card.title }}</a>
      </h3>
      <BbgMeta :created="card.created" :tags="card.tags" :pinned="false" />
    </article>
  </section>
</template>

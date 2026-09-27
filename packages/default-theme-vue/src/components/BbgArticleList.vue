<script setup lang="ts">
import type { ArticleListModel } from '@bbg-next/view'
import { labels } from '@bbg-next/default-theme-shared'
import { Pin } from '@lucide/vue'
import { useTemplateRef } from 'vue'
import { useEntrance } from '../entrance.ts'
import Icon from './Icon.vue'
import MetaRow from './MetaRow.vue'

const props = defineProps<{ model: ArticleListModel }>()
const t = labels()
useEntrance(useTemplateRef('main'), () => props.model.page)
</script>

<template>
  <main ref="main">
    <div>
      <p v-if="model.articles.length === 0" class="py-12 text-muted">{{ t.empty }}</p>
      <article
        v-for="card of model.articles"
        :key="card.slug"
        class="bbg-card my-7.5 rounded-md bg-surface p-5 shadow-card"
      >
        <!-- As in the original, a pinned card shows only its label and title. -->
        <div v-if="card.pinned" class="text-muted"><Icon :icon="Pin" /> {{ t.pinned }}</div>
        <h2 class="bbg-card-title mb-2 fs-2 leading-[1.2] font-medium">
          <a
            :href="card.href"
            class="relative text-accent before:absolute before:inset-x-0 before:bottom-0 before:h-0.5 before:scale-x-0 before:bg-accent before:transition-transform before:duration-300 hover:text-accent-hover hover:before:scale-x-100"
            >{{ card.title }}</a
          >
        </h2>
        <template v-if="!card.pinned">
          <MetaRow :card="card" />
          <p v-if="card.excerpt !== ''" class="mt-6 mb-4">{{ card.excerpt }}</p>
        </template>
      </article>
    </div>
    <nav class="bbg-pagination flex flex-wrap gap-1" :hidden="model.totalPages <= 1">
      <a
        v-for="page of model.pageLinks"
        :key="page.href"
        :href="page.href"
        :aria-current="page.current ? 'page' : undefined"
        class="ripple rounded-[.2rem] border border-transparent px-2 py-1 text-sm text-accent underline transition-colors hover:text-accent-hover aria-[current=page]:border-control aria-[current=page]:bg-control aria-[current=page]:text-on-control aria-[current=page]:no-underline"
        >{{ page.page }}</a
      >
    </nav>
    <p class="mt-6 mb-4 text-muted" :hidden="model.totalPages <= 1">{{ t.pageOf(model.page, model.totalPages) }}</p>
  </main>
</template>

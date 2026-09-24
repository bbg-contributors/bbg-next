<script setup lang="ts">
import type { TagLink } from '@bbg-next/view'
import { computed } from 'vue'

const props = defineProps<{ created: number; tags: readonly TagLink[]; pinned: boolean }>()

const date = computed(() => {
  if (props.created === 0) return ''
  const lang = document.documentElement.lang

  return new Intl.DateTimeFormat(lang === '' ? undefined : lang, { dateStyle: 'medium' }).format(props.created)
})
</script>

<template>
  <div class="bbg-meta">
    <span v-if="pinned" class="bbg-pin">Pinned</span>
    <time v-if="date !== ''">{{ date }}</time>
    <a v-for="tag of tags" :key="tag.name" :href="tag.href" class="bbg-tag">#{{ tag.name }}</a>
  </div>
</template>

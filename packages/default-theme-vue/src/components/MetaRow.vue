<script setup lang="ts">
import type { ArticleCard } from '@bbg-next/view'
import { labels, tagColor } from '@bbg-next/default-theme-shared'
import { Tags } from '@lucide/vue'
import { computed } from 'vue'
import { stamps } from '../stamps.ts'
import Icon from './Icon.vue'
import Stamp from './Stamp.vue'

const props = defineProps<{ card: Pick<ArticleCard, 'created' | 'updated' | 'tags'> }>()
const t = labels()
const dates = computed(() => stamps(props.card, t))
</script>

<template>
  <div class="text-muted">
    <div v-if="dates[0]">
      <Stamp v-bind="dates[0]" dotted />
      <template v-if="dates[1]">
        <span class="mx-1">|</span>
        <Stamp v-bind="dates[1]" dotted />
      </template>
    </div>
    <div v-if="card.tags.length > 0" class="mt-1.5">
      <Icon :icon="Tags" /> {{ t.tags
      }}<a
        v-for="tag of card.tags"
        :key="tag.name"
        :href="tag.href"
        class="ml-2 underline decoration-1 [text-underline-position:under]"
        :style="{ color: tagColor(tag.name) }"
        >#{{ tag.name }}</a
      >
    </div>
  </div>
</template>

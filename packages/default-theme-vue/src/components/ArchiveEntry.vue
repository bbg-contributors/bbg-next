<script setup lang="ts">
import type { ArticleCard } from '@bbg-next/view'
import { labels } from '@bbg-next/default-theme-shared'
import { FileText } from '@lucide/vue'
import { computed } from 'vue'
import { stamps } from '../stamps.ts'
import Icon from './Icon.vue'
import Stamp from './Stamp.vue'

const props = defineProps<{ card: ArticleCard }>()
const t = labels()
const [open, separator, close] = t.aside
const dates = computed(() => stamps(props.card, t))
</script>

<template>
  <p class="mb-4">
    <Icon :icon="FileText" />
    <a :href="card.href" class="text-accent underline hover:text-accent-hover">{{ card.title }}</a
    ><template v-if="dates[0]"
      >{{ open }}<Stamp v-bind="dates[0]" /><template v-if="dates[1]"
        >{{ separator }}<Stamp v-bind="dates[1]" /></template
      >{{ close }}</template
    >
  </p>
</template>

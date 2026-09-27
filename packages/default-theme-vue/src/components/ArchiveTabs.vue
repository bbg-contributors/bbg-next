<script setup lang="ts">
import type { ArticleCard } from '@bbg-next/view'
import { group, labels } from '@bbg-next/default-theme-shared'
import { Calendar, Tags } from '@lucide/vue'
import { computed, ref } from 'vue'
import ArchiveEntry from './ArchiveEntry.vue'
import ArchiveHeading from './ArchiveHeading.vue'
import Panel from './Panel.vue'
import TagName from './TagName.vue'

const props = defineProps<{ articles: readonly ArticleCard[] }>()
const t = labels()
const selected = ref(0)
const tagged = computed(() => group(props.articles, card => card.tags.map(tag => tag.name)))
const untagged = computed(() => props.articles.filter(card => card.tags.length === 0))
const years = computed(() => group(props.articles, card => [new Date(card.created).getFullYear()]))
</script>

<template>
  <div class="mt-12 flex flex-wrap border-b border-line" role="tablist">
    <!-- Eases in, as snapping to the selection would cut off the press's ripple. -->
    <button
      v-for="(label, index) of [t.byTag, t.byYear]"
      :key="label"
      type="button"
      role="tab"
      :aria-selected="index === selected"
      class="ripple -mb-px cursor-pointer rounded-t-[.25rem] border border-transparent px-4 py-2 text-accent transition-colors duration-300 hover:text-accent-hover aria-selected:cursor-default aria-selected:border-line aria-selected:border-b-page aria-selected:bg-surface aria-selected:text-fg"
      @click="selected = index"
    >
      {{ label }}
    </button>
  </div>
  <Panel role="tabpanel" :hidden="selected !== 0">
    <template v-for="[name, cards] of tagged" :key="name">
      <ArchiveHeading :icon="Tags"><TagName :name="name" /></ArchiveHeading>
      <ArchiveEntry v-for="card of cards" :key="card.slug" :card="card" />
    </template>
    <template v-if="untagged.length > 0">
      <ArchiveHeading level="h3" :icon="Tags">{{ t.untagged }}</ArchiveHeading>
      <ArchiveEntry v-for="card of untagged" :key="card.slug" :card="card" />
    </template>
  </Panel>
  <Panel role="tabpanel" :hidden="selected !== 1">
    <template v-for="[year, cards] of years" :key="year">
      <ArchiveHeading :icon="Calendar">{{ year }}</ArchiveHeading>
      <ArchiveEntry v-for="card of cards" :key="card.slug" :card="card" />
    </template>
  </Panel>
</template>

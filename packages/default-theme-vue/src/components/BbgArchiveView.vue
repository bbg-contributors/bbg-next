<script setup lang="ts">
import type { ArchiveModel } from '@bbg-next/view'
import { labels } from '@bbg-next/default-theme-shared'
import { Tags } from '@lucide/vue'
import { useTemplateRef } from 'vue'
import { useEntrance } from '../entrance.ts'
import ArchiveEntry from './ArchiveEntry.vue'
import ArchiveTabs from './ArchiveTabs.vue'
import Banner from './Banner.vue'
import Icon from './Icon.vue'
import Panel from './Panel.vue'
import TagName from './TagName.vue'

const props = defineProps<{ model: ArchiveModel }>()
const t = labels()
useEntrance(useTemplateRef('main'), () => props.model.tag)
</script>

<template>
  <Banner :title="t.archive">
    <template v-if="model.tag !== null" #title>
      <span><Icon :icon="Tags" /> {{ t.tagged[0] }}<TagName :name="model.tag" />{{ t.tagged[1] }}</span>
    </template>
  </Banner>
  <main ref="main">
    <ArchiveTabs v-if="model.tag === null" :articles="model.articles" />
    <Panel v-else>
      <ArchiveEntry v-for="card of model.articles" :key="card.slug" :card="card" />
    </Panel>
  </main>
</template>

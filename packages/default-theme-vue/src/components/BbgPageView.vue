<script setup lang="ts">
import type { PageModel } from '@bbg-next/view'
import { useTemplateRef } from 'vue'
import { useEntrance } from '../entrance.ts'
import Banner from './Banner.vue'

const props = defineProps<{ model: PageModel }>()
useEntrance(useTemplateRef('main'), () => props.model.html)
</script>

<template>
  <Banner :title="model.title" />
  <main ref="main">
    <!-- Tighter than an article's, as in the original; runtime-rendered, raw HTML disabled -->
    <div class="bbg-content my-7.5 rounded-md bg-surface p-4 shadow-card" v-html="model.html" />
  </main>
</template>

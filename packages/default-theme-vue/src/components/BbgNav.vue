<script setup lang="ts">
import type { ShellModel } from '@bbg-next/view'

defineProps<{ model: ShellModel }>()
</script>

<template>
  <header class="bbg-site-header">
    <h1 class="bbg-site-title">
      <a :href="model.home.href">{{ model.title }}</a>
    </h1>
    <p v-if="model.description !== ''" class="bbg-site-description">{{ model.description }}</p>
    <nav class="bbg-site-nav">
      <a
        v-for="item of model.links"
        :key="item.href"
        :href="item.href"
        :aria-current="item.current ? 'page' : undefined"
        >{{ item.label }}</a
      >
      <a :href="model.archive.href" :aria-current="model.archive.current ? 'page' : undefined">Archive</a>
    </nav>
  </header>
</template>

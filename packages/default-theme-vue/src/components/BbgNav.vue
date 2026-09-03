<script setup lang="ts">
import type { ShellModel } from '@bbg-next/view'

defineProps<{ model: ShellModel }>()
</script>

<template>
  <header class="bbg-site-header">
    <h1 class="bbg-site-title">
      <a :href="model.homeHref">{{ model.title }}</a>
    </h1>
    <p v-if="model.description !== ''" class="bbg-site-description">{{ model.description }}</p>
    <nav v-if="model.links.length > 0" class="bbg-site-nav">
      <a v-for="item of model.links" :key="item.href" :href="item.href">{{ item.label }}</a>
    </nav>
  </header>
</template>

<script setup lang="ts">
import type { ShellModel } from '@bbg-next/view'
import { labels } from '@bbg-next/default-theme-shared'
import { Menu } from '@lucide/vue'
import { ref } from 'vue'
import Banner from './Banner.vue'
import IconButton from './IconButton.vue'
import NavLink from './NavLink.vue'

defineProps<{ model: ShellModel }>()
const t = labels()
const open = ref(false)

// The bar stays on screen when a link is followed, so the menu has to fold itself.
function fold(event: MouseEvent): void {
  if (event.target instanceof Element && event.target.closest('a') !== null) open.value = false
}
</script>

<template>
  <header class="fixed inset-x-0 top-0 z-10 bg-bar text-on-bar shadow-bar">
    <div class="flex flex-wrap items-center px-3" @click="fold">
      <a :href="model.home.href" class="mr-4 py-2.5 font-bold">{{ model.title }}</a>
      <IconButton
        class="ml-auto cursor-pointer rounded px-3 py-1 text-xl lg:hidden"
        :label="t.menu"
        :icon="Menu"
        @click="open = !open"
      />
      <div
        class="hidden basis-full flex-col pb-2 data-open:flex lg:flex lg:basis-auto lg:flex-row lg:pb-0"
        :data-open="open ? '' : undefined"
      >
        <NavLink :link="model.home">{{ t.articles }}</NavLink>
        <NavLink :link="model.archive">{{ t.archive }}</NavLink>
        <nav class="bbg-site-nav flex flex-col lg:flex-row">
          <NavLink v-for="page of model.links" :key="page.href" :link="page">{{ page.label }}</NavLink>
        </nav>
      </div>
    </div>
  </header>
  <div class="column">
    <Banner :title="model.title">
      <p v-if="model.description !== ''" class="mb-4 text-xl">{{ model.description }}</p>
    </Banner>
  </div>
</template>

<script setup lang="ts">
import type { ShellAction, ShellModel } from '@bbg-next/view'
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

function press(action: ShellAction): void {
  open.value = false
  action.run()
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
        class="hidden basis-full flex-col pb-2 data-open:flex lg:flex lg:grow lg:basis-auto lg:flex-row lg:pb-0"
        :data-open="open ? '' : undefined"
      >
        <NavLink :link="model.home">{{ t.articles }}</NavLink>
        <NavLink :link="model.archive">{{ t.archive }}</NavLink>
        <nav class="bbg-site-nav flex flex-col lg:flex-row">
          <NavLink v-for="page of model.links" :key="page.href" :link="page">{{ page.label }}</NavLink>
        </nav>
        <div class="flex items-center lg:mr-1 lg:ml-auto">
          <!-- Outlined and spaced as the original's search button was. -->
          <button
            v-for="action of model.actions"
            :key="action.label"
            type="button"
            class="ripple mt-2 -mb-1 cursor-pointer rounded border border-on-bar px-3 py-1.5 transition-colors hover:bg-bar-hover lg:my-0"
            @click="press(action)"
          >
            <span class="*:inline-block *:size-[1em] *:align-[-0.125em]" aria-hidden="true" v-html="action.icon" />
            {{ action.label }}
          </button>
        </div>
      </div>
    </div>
  </header>
  <div class="column">
    <Banner :title="model.title">
      <p v-if="model.description !== ''" class="mb-4 text-xl">{{ model.description }}</p>
    </Banner>
  </div>
</template>

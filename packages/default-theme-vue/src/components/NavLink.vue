<script setup lang="ts">
import type { ViewLink } from '@bbg-next/view'

defineProps<{ link: ViewLink }>()
</script>

<template>
  <!-- Unpadded when folded into the menu, flush with the title as in Bootstrap's navbar. -->
  <a
    :href="link.href"
    :aria-current="link.current ? 'page' : undefined"
    class="ripple block py-2.5 transition-colors after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:scale-x-0 after:bg-on-bar after:transition-transform after:duration-300 hover:bg-bar-hover aria-[current=page]:after:scale-x-100 lg:px-2"
    ><slot
  /></a>
</template>

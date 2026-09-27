<script setup lang="ts">
defineProps<{ title?: string }>()
</script>

<template>
  <!-- No fill, so a wallpaper shows through. -->
  <div class="bbg-hero pt-13 pb-12">
    <h1 class="mb-2 text-[50px] leading-[1.2] font-medium">
      <slot name="title">{{ title }}</slot>
    </h1>
    <slot />
  </div>
</template>

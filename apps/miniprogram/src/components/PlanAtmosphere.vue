<script setup lang="ts">
import { computed, inject, isRef, type Ref } from 'vue'
import { ICON_PALETTE_KEY, fallbackIconPalette, type IconPalette } from '../icon-system'
import { planAtmosphere } from '../plan-atmosphere'

defineOptions({ options: { virtualHost: true } })
const provided = inject<Ref<IconPalette> | IconPalette>(ICON_PALETTE_KEY, fallbackIconPalette)
const source = computed(() => planAtmosphere(isRef(provided) ? provided.value : provided))
</script>

<template>
  <view class="plan-atmosphere" aria-hidden="true">
    <image class="plan-book-art" :src="source" mode="aspectFit" :draggable="false" />
  </view>
</template>

<style scoped>
.plan-atmosphere { position:fixed; top:0; left:0; right:0; width:100%; max-width:440px; height:100vh; margin:0 auto; z-index:0; pointer-events:none; }
.plan-book-art { display:block; width:100%; height:100%; }
</style>

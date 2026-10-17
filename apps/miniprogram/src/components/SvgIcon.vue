<script setup lang="ts">
import { computed } from 'vue'
import { iconSources } from '../icons'

const props = withDefaults(defineProps<{ name: string; light?: boolean; size?: number }>(), { size: 22, light: false })
const source = computed(() => (iconSources[props.name as keyof typeof iconSources] || iconSources.arrow)[props.light ? 'light' : 'ink'])
</script>

<template>
  <view class="svg-icon" :class="{ 'svg-icon-light': light }" :style="{ width: `${size}px`, height: `${size}px` }" aria-hidden="true">
    <image :src="source" mode="aspectFit" :draggable="false" />
  </view>
</template>

<style scoped>
.svg-icon { display:inline-flex; align-items:center; justify-content:center; flex-shrink:0; vertical-align:middle; pointer-events:none; }
.svg-icon image { display:block; width:100%; height:100%; filter:var(--icon-filter, none); }
.svg-icon-light image { filter:none; }
</style>

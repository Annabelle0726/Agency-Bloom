<script setup lang="ts">
import { computed, inject, isRef, type Ref } from 'vue'
import { ICON_PALETTE_KEY, fallbackIconPalette, iconBodies, iconDataUri, type IconName, type IconPalette } from '../icon-system'

defineOptions({ options: { virtualHost: true } })
const props = withDefaults(defineProps<{
  name: string
  light?: boolean
  size?: number
  tone?: 'ink' | 'accent' | 'muted' | 'paper'
  color?: string
}>(), { size: 22, light: false, tone: 'ink' })

// index.vue provides the active palette for the six themes. The fallback keeps
// isolated component use (tests, previews) readable without a provider.
const provided = inject<Ref<IconPalette> | IconPalette>(ICON_PALETTE_KEY, fallbackIconPalette)
const palette = computed(() => isRef(provided) ? provided.value : provided)
const resolvedName = computed<IconName>(() => props.name in iconBodies ? props.name as IconName : 'arrow')
const color = computed(() => props.color || (props.light ? '#ffffff' : palette.value[props.tone] || palette.value.ink))
const source = computed(() => iconDataUri(resolvedName.value, color.value))
</script>

<template>
  <view class="svg-icon" :style="{ width: `${size}px`, height: `${size}px` }" aria-hidden="true">
    <image :src="source" mode="aspectFit" :draggable="false" />
  </view>
</template>

<style scoped>
.svg-icon { display:flex; align-items:center; justify-content:center; flex-shrink:0; line-height:0; pointer-events:none; }
.svg-icon image { display:block; width:100%; height:100%; }
</style>

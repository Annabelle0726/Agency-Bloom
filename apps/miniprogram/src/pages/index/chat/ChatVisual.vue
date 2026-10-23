<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { resolveStoredVisual } from '../../../visual-library'
defineOptions({ options: { styleIsolation: 'apply-shared' } })
const props = defineProps<{ visualId?: string | null; themeId: string }>()
const selected = computed(() => resolveStoredVisual(props.visualId, props.themeId))
const loaded = ref(false), failed = ref(false)
watch(() => selected.value?.src, () => { loaded.value = false; failed.value = false })
function preview() {
  if (selected.value && loaded.value) uni.previewImage({ urls: [selected.value.src] })
}
</script>

<template>
  <view v-if="selected && !failed" class="message-visual-frame" hover-class="visual-pressed"
        :hover-start-time="0" :hover-stay-time="70" @click="preview">
    <image :key="selected.src" class="message-visual" :class="{ 'visual-loaded': loaded }"
           :src="selected.src" mode="aspectFill" lazy-load
           aria-label="为这段探索从图库选择的图片" @load="loaded = true" @error="failed = true" />
  </view>
</template>

<style scoped>
.message-visual-frame { width:126px; height:202px; margin-top:10px; border-radius:8px; overflow:hidden; background:var(--soft); transition:transform 130ms ease; }
.message-visual { display:block; width:100%; height:100%; opacity:0; transition:opacity 160ms ease; }
.visual-loaded { opacity:1; }
.visual-pressed { transform:scale(.985); }
@media (prefers-reduced-motion:reduce) { .message-visual-frame,.message-visual { transition:none; } }
</style>

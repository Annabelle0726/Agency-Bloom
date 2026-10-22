<script setup lang="ts">
import type { ResolvedVisual } from '../../../visual-library'

defineOptions({ options: { styleIsolation: 'apply-shared' } })
defineProps<{ visual: ResolvedVisual | null }>()
</script>

<template>
  <view v-if="visual" class="chat-explore-moment">
    <image class="chat-explore-photo" :src="visual.src" mode="aspectFill" aria-hidden="true" />
    <view class="chat-explore-copy">
      <text class="eyebrow">EXPLORING</text>
      <text class="chat-explore-description">{{ visual.description }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { navigationItems } from '../../../themes'
import type { SpaceTab } from '../../../themes'

defineOptions({ options: { styleIsolation: 'apply-shared' } })

defineProps<{
  tab: SpaceTab
  navImages: Record<string, string>
}>()
const emit = defineEmits<{ select: [tab: SpaceTab] }>()
</script>

<template>
  <view class="tabbar journey-nav" role="navigation" aria-label="主导航">
    <button
        v-for="item in navigationItems"
        :key="item.id" :data-tab="item.id" class="nav-item"
        :class="{ active: tab === item.id, 'nav-conversation': item.id === 'chat' }"
        :aria-label="item.label" :aria-current="tab === item.id ? 'page' : undefined"
        hover-class="nav-pressed" :hover-start-time="0" :hover-stay-time="70"
        @click="emit('select', item.id)">
      <view class="tab-icon-frame">
        <image class="tab-glyph" :src="navImages[item.id]" mode="aspectFit"/>
      </view>
      <text class="nav-label">{{ item.label }}</text>
    </button>
  </view>
</template>

<script setup lang="ts">
import { iconSources } from '../../../icons'

defineOptions({ options: { styleIsolation: 'apply-shared' } })

defineProps<{ dark: boolean }>()
const emit = defineEmits<{ history: []; settings: [] }>()
</script>

<template>
  <view class="topbar header-chrome">
    <button class="chat-header-button" aria-label="打开会话列表" hover-class="pressed" :hover-start-time="0"
            :hover-stay-time="70" @click="emit('history')">
      <image class="chat-header-glyph" :src="iconSources.menu.ink" mode="aspectFit" aria-hidden="true" />
    </button>
    <view class="brand-lockup" aria-label="Agency Bloom">
      <image class="brand-lockup-symbol"
             :src="dark ? '/static/brand-sprout-night.png' : '/static/brand-sprout.png'"
             mode="aspectFit" />
      <text class="space-wordmark">AGENCY BLOOM</text>
    </view>
    <button class="chat-header-button" aria-label="打开我的设置" hover-class="pressed" :hover-start-time="0"
            :hover-stay-time="70" @click="emit('settings')">
      <image class="chat-header-glyph" :src="iconSources.user.ink" mode="aspectFit" aria-hidden="true" />
    </button>
  </view>
</template>

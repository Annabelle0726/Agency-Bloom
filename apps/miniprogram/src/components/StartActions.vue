<script setup lang="ts">
import SvgIcon from './SvgIcon.vue'
defineOptions({ options: { styleIsolation: 'apply-shared' } })
defineProps<{ disabled?: boolean }>()
defineEmits<{ chat: []; onboarding: [] }>()
</script>

<template>
  <view class="start-actions">
    <button class="start-action start-chat surface-action surface-action-primary" :disabled="disabled" hover-class="surface-action-pressed" :hover-start-time="0" :hover-stay-time="70" @click="!disabled && $emit('chat')">
      <text>直接聊聊</text><SvgIcon name="arrow" :size="18" :light="!disabled" tone="muted" />
    </button>
    <button class="start-action start-questions surface-action surface-action-secondary" :disabled="disabled" hover-class="surface-action-pressed" :hover-start-time="0" :hover-stay-time="70" @click="!disabled && $emit('onboarding')">
      <text>用几个问题整理起点</text>
    </button>
  </view>
</template>

<style scoped>
.start-actions { display:flex; flex-direction:column; gap:10px; width:100%; }
</style>

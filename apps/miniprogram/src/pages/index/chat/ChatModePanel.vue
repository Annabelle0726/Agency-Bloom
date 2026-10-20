<script setup lang="ts">
import SvgIcon from '../../../components/SvgIcon.vue'
import { supportStyles } from '../../../onboarding'
import type { SupportMode } from '../../../onboarding'

defineOptions({ options: { styleIsolation: 'apply-shared' } })

defineProps<{
  selectedMode: string
  busy: boolean
  sending: boolean
}>()
const emit = defineEmits<{ select: [mode: SupportMode] }>()
</script>

<template>
  <view class="chat-mode-panel">
    <text class="chat-mode-panel-caption">只是回应偏好，随时可以更改</text>
    <button v-for="mode in supportStyles" :key="mode.id" class="chat-mode-choice"
            :class="{ chosen: selectedMode === mode.id }" :data-mode="mode.id"
            :disabled="busy || sending" @click="emit('select', mode.id as SupportMode)"
            hover-class="pressed" :hover-start-time="0" :hover-stay-time="70">
      <view class="chat-mode-copy">
        <text class="chat-mode-name">{{ mode.title }}</text>
        <text class="chat-mode-detail">{{ mode.detail }}</text>
      </view>
      <SvgIcon v-if="selectedMode === mode.id" name="check" :size="17" />
    </button>
  </view>
</template>

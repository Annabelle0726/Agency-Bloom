<script setup lang="ts">
import CompanionAvatar from '../../../components/CompanionAvatar.vue'
import SvgIcon from '../../../components/SvgIcon.vue'
import type { ReplyPhase } from '../../../chat-stream'

defineOptions({ options: { styleIsolation: 'apply-shared' } })

defineProps<{ generatingSummary: boolean; phase?: ReplyPhase; streamText?: string }>()
</script>

<template>
  <view class="thinking streaming-reply">
    <CompanionAvatar :size="38" :state="streamText ? 'speaking' : 'thinking'" :interactive="false" :online="false" />
    <view class="thinking-copy">
      <text class="message-name">Bloom</text>
      <view class="reply-phase" role="status">
        <SvgIcon :name="phase === 'thinking' ? 'layers' : 'chat'" tone="muted" :size="14" />
        <text>{{ generatingSummary ? '正在整理会话' : phase === 'thinking' ? '深度思考中' : phase === 'writing' ? '正在回复' : phase === 'checking' ? '正在完成回复' : '等待回应' }}</text>
      </view>
      <text v-if="streamText" class="message-bubble stream-text">{{ streamText }}</text>
    </view>
  </view>
</template>

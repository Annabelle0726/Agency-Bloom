<script setup lang="ts">
import { computed, ref } from 'vue'
import CompanionAvatar from '../../../components/CompanionAvatar.vue'
import SvgIcon from '../../../components/SvgIcon.vue'
import type { ChatMessage } from '../../../domain'

defineOptions({ options: { styleIsolation: 'apply-shared' } })

const props = defineProps<{
  message: ChatMessage
  index: number
  isLast: boolean
  speaking: boolean
  userAvatar: string
}>()

const open = ref(false)
const steps = computed(() => Array.isArray(props.message.payload?.thinking_steps)
  ? props.message.payload!.thinking_steps!
  : [])
</script>

<template>
  <view :id="'message-' + index" class="message-row" :class="message.role">
    <CompanionAvatar v-if="message.role === 'assistant'" :size="38" online
                     :state="speaking ? 'speaking' : (isLast ? 'idle' : 'rest')" />
    <image v-else class="chat-avatar"
           :src="userAvatar || '/static/avatar-user.png'"
           mode="aspectFill" aria-label="你的头像"/>
    <view class="message-content">
      <text v-if="message.role === 'assistant'" class="message-name">AGENCY BLOOM</text>
      <button v-if="message.role === 'assistant' && steps.length"
              class="thinking-toggle" :aria-expanded="open"
              @click="open = !open" hover-class="pressed" :hover-start-time="0" :hover-stay-time="70">
        <text>{{ open ? '收起思考过程' : '查看思考过程' }}</text>
        <view class="thinking-chevron" :class="{ 'is-open': open }"><SvgIcon name="chevron" :size="12"/></view>
      </button>
      <view v-if="message.role === 'assistant' && open" class="thinking-steps">
        <text v-for="(step, stepIndex) in steps" :key="stepIndex" class="thinking-step">{{ step }}</text>
      </view>
      <text class="message-bubble">{{ message.content }}</text>
      <view v-if="message.role === 'assistant' && message.payload?.web_sources?.length" class="web-sources">
        <text class="web-sources-label">根据网上资料（未经核实）</text>
        <view v-for="(source, sourceIndex) in message.payload.web_sources" :key="sourceIndex" class="web-source-row">
          <text class="web-source-site">{{ source.site || '来源' }}</text>
          <text class="web-source-name">{{ source.name || source.url }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

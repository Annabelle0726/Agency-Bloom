<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import SvgIcon from '../../../components/SvgIcon.vue'
import type { Conversation } from '../../../domain'

defineOptions({ options: { styleIsolation: 'apply-shared' } })

const props = defineProps<{
  draft: string
  creating?: boolean
  sending: boolean
  sendingStartedAt: number
  generatingSummary: boolean
  readOnlyConversation: boolean
  activeConversation: Conversation | null
  isDrafting: boolean
  webSearchOn: boolean
  chatFooterNote: string
}>()
const emit = defineEmits<{
  draftChange: [value: string]
  toggleWeb: []
  send: []
  cancel: []
}>()

const placeholder = computed(() => props.webSearchOn
  ? '联网搜索已开启，问问需要查证的事'
  : (props.isDrafting ? '发送后才会创建这段对话' : '想到什么，就从哪里说起……'))

const localDraft = ref(props.draft)
const now = ref(Date.now())
let waitTimer: ReturnType<typeof setInterval> | undefined
watch(() => props.sendingStartedAt, started => {
  if (waitTimer) clearInterval(waitTimer)
  waitTimer = undefined
  now.value = Date.now()
  if (started) waitTimer = setInterval(() => { now.value = Date.now() }, 1000)
}, { immediate: true })
onUnmounted(() => { if (waitTimer) clearInterval(waitTimer) })
const elapsed = computed(() => props.sendingStartedAt ? Math.max(0, Math.floor((now.value - props.sendingStartedAt) / 1000)) : 0)
watch(() => props.draft, value => {
  if (value !== localDraft.value) localDraft.value = value
})

function onInput(event: Event) {
  const value = (event as CustomEvent<{ value: string }>).detail.value
  localDraft.value = value
  emit('draftChange', value)
}
</script>

<template>
  <view class="composer-dock">
    <view v-if="sending" class="reply-wait" role="status" aria-live="polite">
      <view class="reply-wait-copy">
        <view class="reply-wait-heading">
          <view class="reply-wait-dots" aria-hidden="true"><view/><view/><view/></view>
          <text>{{ generatingSummary ? '正在整理会话' : '等待 Bloom 回复' }}</text>
          <text class="reply-wait-time">{{ elapsed }} 秒</text>
        </view>
        <text class="reply-wait-note">{{ elapsed >= 15 ? '这次稍久，可以继续等或停止' : '可以随时停止，原输入会保留' }}</text>
      </view>
      <button class="reply-wait-stop" aria-label="停止回复" @click="emit('cancel')"
              hover-class="pressed" :hover-start-time="0" :hover-stay-time="70">
        <SvgIcon name="stop" :size="16"/><text>停止</text>
      </button>
    </view>
    <view v-else class="composer">
      <button class="web-toggle" :aria-pressed="webSearchOn"
              :aria-label="webSearchOn ? '已开启联网搜索' : '开启联网搜索'"
              :class="{ on: webSearchOn }" :disabled="creating || sending || readOnlyConversation"
              @click="emit('toggleWeb')"
              hover-class="pressed" :hover-start-time="0" :hover-stay-time="70">
        <SvgIcon name="compass" :size="15"/>
      </button>
      <textarea v-model="localDraft" class="chat-input" :disabled="creating || readOnlyConversation || (!activeConversation && !isDrafting)" :adjust-position="false" @input="onInput"
                                     :cursor-spacing="24" maxlength="2000" :auto-height="true"
                                     :placeholder="placeholder"/>
      <button class="send-button" :disabled="creating || (!sending && (!draft.trim() || readOnlyConversation || (!activeConversation && !isDrafting)))"
              :aria-label="sending ? '停止回复' : '发送消息'" @click="!creating && (sending ? emit('cancel') : emit('send'))"
              hover-class="pressed" :hover-start-time="0" :hover-stay-time="70">
        <SvgIcon :name="sending ? 'stop' : 'arrow-up'" light :size="21"/>
      </button>
    </view>
    <text v-if="!sending" class="chat-disclosure">{{ creating ? '正在保存这段会话，输入会保留' : chatFooterNote }}</text>
  </view>
</template>

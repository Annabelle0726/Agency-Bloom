<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, onMounted, onUnmounted, onUpdated, ref, watch } from 'vue'
import SvgIcon from '../../../components/SvgIcon.vue'
import { CHAT_INPUT_LIMIT } from '../../../chat-limits'
import type { Conversation } from '../../../domain'

defineOptions({ options: { styleIsolation: 'apply-shared' } })

const props = defineProps<{
  draft: string
  selectedQuote?: string
  creating?: boolean
  sending: boolean
  sendingStartedAt: number
  generatingSummary: boolean
  readOnlyConversation: boolean
  activeConversation: Conversation | null
  isDrafting: boolean
  webSearchOn: boolean
  chatFooterNote: string
  error?: string
  recoverable?: boolean
  recoveryBusy?: boolean
}>()
const emit = defineEmits<{
  draftChange: [value: string]
  toggleWeb: []
  send: []
  cancel: []
  clearQuote: []
  focus: []
  recover: []
  dismissError: []
  layout: [height: number]
}>()

const placeholder = computed(() => props.sending ? '回复中，可以随时停止'
  : props.webSearchOn
  ? '联网搜索已开启，问问需要查证的事'
  : (props.isDrafting ? '发送后才会创建这段对话' : '想到什么，就从哪里说起……'))

const localDraft = ref(props.draft)
// Keep the native textarea mounted. The pending bubble shows the submitted
// text once; the session retains the full draft for stop/failure recovery.
const visibleDraft = computed(() => props.sending && !props.generatingSummary ? '' : localDraft.value)
const instance = getCurrentInstance()
let measuredHeight = 0, measureQueued = false, disposed = false
function measureLayout() {
  if (measureQueued || disposed) return
  measureQueued = true
  void nextTick(() => {
    measureQueued = false
    if (disposed) return
    uni.createSelectorQuery().in(instance?.proxy).select('.composer-dock').boundingClientRect(rect => {
      if (disposed || !rect || Array.isArray(rect) || !rect.height) return
      const height = Math.ceil(rect.height)
      if (height !== measuredHeight) { measuredHeight = height; emit('layout', height) }
    }).exec()
  })
}
onMounted(measureLayout)
onUpdated(measureLayout)
onUnmounted(() => { disposed = true })
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

// One row (input | web | send) while the draft is short; once it wraps past
// two lines the web toggle stacks above the send key on the right rail.
const WEB_LINE_BUDGET = 88
const multiline = computed(() => localDraft.value.length > WEB_LINE_BUDGET)
</script>

<template>
  <view class="composer-dock">
    <slot name="notice" />
    <view v-if="error" class="composer-error" role="alert">
      <view class="composer-error-row">
        <text class="composer-error-message">{{ error }}</text>
        <button class="composer-error-close" aria-label="关闭异常提示" @click="emit('dismissError')" hover-class="pressed"><SvgIcon name="close" :size="15" /></button>
      </view>
      <button v-if="recoverable" class="composer-error-recover" :disabled="recoveryBusy" @click="emit('recover')" hover-class="pressed">查看这条请求的结果<SvgIcon name="arrow" :size="13" /></button>
    </view>
    <view v-if="selectedQuote && !sending" class="selected-quote">
      <view><text class="selected-quote-label">选中的片段</text><text class="selected-quote-text">{{ selectedQuote }}</text></view>
      <button aria-label="移除选中引用" @click="emit('clearQuote')"><SvgIcon name="close" :size="16" /></button>
    </view>
    <view v-if="sending" class="reply-wait" role="status" aria-live="polite">
      <view class="reply-wait-copy">
        <view class="reply-wait-heading">
          <view class="reply-wait-dots" aria-hidden="true"><view/><view/><view/></view>
          <text>{{ generatingSummary ? '正在整理会话' : '等待 Bloom 回复' }}</text>
          <text class="reply-wait-time">{{ elapsed }} 秒</text>
        </view>
        <text v-if="elapsed >= 15" class="reply-wait-note">这次稍久，可以继续等或停止</text>
      </view>
    </view>
    <view class="composer" :class="{ stacked: !sending && multiline }">
      <textarea :value="visibleDraft" class="chat-input" :focus="!!selectedQuote && !sending" :disabled="sending || creating || readOnlyConversation || (!activeConversation && !isDrafting)" :adjust-position="false" @input="onInput" @focus="emit('focus')" @linechange="measureLayout"
                                     :cursor-spacing="24" :maxlength="CHAT_INPUT_LIMIT" :auto-height="true"
                                     :placeholder="placeholder"/>
      <view class="composer-side">
        <button class="web-toggle" :aria-pressed="webSearchOn"
                :aria-label="webSearchOn ? '已开启联网搜索' : '开启联网搜索'"
                :class="{ on: webSearchOn }" :disabled="creating || sending || readOnlyConversation"
                @click="emit('toggleWeb')"
                hover-class="pressed" :hover-start-time="0" :hover-stay-time="70">
          <SvgIcon name="compass" :size="19"/>
        </button>
        <button class="send-button" :class="{ 'reply-wait-stop': sending }" :disabled="creating || (!sending && (!localDraft.trim() || readOnlyConversation || (!activeConversation && !isDrafting)))"
                :aria-label="sending ? '停止回复' : '发送消息'" @click="!creating && (sending ? emit('cancel') : emit('send'))"
                hover-class="pressed" :hover-start-time="0" :hover-stay-time="70">
          <SvgIcon :name="sending ? 'stop' : 'arrow-up'" light :size="19"/>
        </button>
      </view>
    </view>
    <text v-if="!sending" class="chat-disclosure">{{ creating ? '正在保存这段会话，输入会保留' : chatFooterNote }}</text>
  </view>
</template>

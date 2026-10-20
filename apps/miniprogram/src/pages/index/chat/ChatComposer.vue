<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import SvgIcon from '../../../components/SvgIcon.vue'
import type { Conversation } from '../../../domain'

defineOptions({ options: { styleIsolation: 'apply-shared' } })

const props = defineProps<{
  draft: string
  sending: boolean
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
    <view class="composer">
      <button class="web-toggle" :aria-pressed="webSearchOn"
              :aria-label="webSearchOn ? '已开启联网搜索' : '开启联网搜索'"
              :class="{ on: webSearchOn }" :disabled="sending || readOnlyConversation"
              @click="emit('toggleWeb')"
              hover-class="pressed" :hover-start-time="0" :hover-stay-time="70">
        <SvgIcon name="compass" :size="15"/>
      </button>
      <textarea v-model="localDraft" class="chat-input" :disabled="readOnlyConversation || (!activeConversation && !isDrafting)" :adjust-position="false" @input="onInput"
                                     :cursor-spacing="24" maxlength="2000" :auto-height="true"
                                     :placeholder="placeholder"/>
      <button class="send-button" :disabled="!sending && (!draft.trim() || readOnlyConversation || (!activeConversation && !isDrafting))"
              :aria-label="sending ? '停止回复' : '发送消息'" @click="sending ? emit('cancel') : emit('send')"
              hover-class="pressed" :hover-start-time="0" :hover-stay-time="70">
        <SvgIcon :name="sending ? 'stop' : 'arrow-up'" light :size="21"/>
      </button>
    </view>
    <text class="chat-disclosure">{{ chatFooterNote }}</text>
  </view>
</template>

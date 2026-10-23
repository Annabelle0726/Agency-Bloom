<script setup lang="ts">
import CompanionAvatar from '../../../components/CompanionAvatar.vue'
import SvgIcon from '../../../components/SvgIcon.vue'
import ChatExploreVisual from './ChatExploreVisual.vue'
import type { ChatEntry } from '../../../chat-entry'
import type { Conversation } from '../../../domain'
import type { ResolvedVisual } from '../../../visual-library'

defineOptions({ options: { styleIsolation: 'apply-shared' } })

defineProps<{
  isDrafting: boolean
  activeConversation: Conversation | null
  userSaveChat: boolean
  welcomeContext: string
  newChatStarters: readonly string[]
  chatStarters: readonly string[]
  chatEntry: ChatEntry
  sending: boolean
  busy: boolean
  foreground?: boolean
  starterHint: string
  visual?: ResolvedVisual | null
}>()
const emit = defineEmits<{ starter: [prompt: string] }>()
</script>

<template>
  <view v-if="isDrafting" class="chat-welcome">
    <view class="chat-welcome-intro">
      <view class="chat-welcome-avatar"><CompanionAvatar :size="32" state="idle" :follow-gaze="true" :foreground="foreground && !busy && !sending" /></view>
      <text class="body-copy">想说什么，就从哪里说起，发送后这段对话才会被创建</text>
    </view>
    <ChatExploreVisual :visual="visual || null" />
    <text v-if="!userSaveChat" class="welcome-context">未开启聊天保存：这段对话的原文只在本次使用中可见，不会为你伪造可恢复的历史</text>
    <text v-if="welcomeContext" class="welcome-context">{{ welcomeContext }}</text>
    <view class="chat-starter-heading">
      <text>可以这样开始</text>
      <text>点选后填入输入框</text>
    </view>
    <view class="prompt-list">
      <button v-for="prompt in newChatStarters" :key="prompt" class="prompt-button"
              :disabled="sending || busy" @click="emit('starter', prompt)"
              hover-class="pressed" :hover-start-time="0" :hover-stay-time="70">
        <text>{{ prompt }}</text>
        <SvgIcon name="arrow-diagonal" :size="16" />
      </button>
    </view>
    <text v-if="starterHint" class="chat-starter-hint">{{ starterHint }}</text>
  </view>
  <view v-else-if="activeConversation" class="chat-welcome">
    <view class="chat-welcome-intro">
      <view class="chat-welcome-avatar"><CompanionAvatar :size="32" state="idle" :follow-gaze="true" :foreground="foreground && !busy && !sending" /></view>
      <text class="body-copy">{{ chatEntry.introduction }}</text>
    </view>
    <ChatExploreVisual :visual="visual || null" />
    <text v-if="welcomeContext" class="welcome-context">{{ welcomeContext }}</text>
    <view class="chat-starter-heading">
      <text>也可以这样开始</text>
      <text>点选后填入输入框</text>
    </view>
    <view class="prompt-list">
      <button v-for="prompt in chatStarters" :key="prompt" class="prompt-button"
              :disabled="sending || busy" @click="emit('starter', prompt)"
              hover-class="pressed" :hover-start-time="0" :hover-stay-time="70">
        <text>{{ prompt }}</text>
        <SvgIcon name="arrow-diagonal" :size="16" />
      </button>
    </view>
    <text v-if="starterHint" class="chat-starter-hint">{{ starterHint }}</text>
  </view>
</template>

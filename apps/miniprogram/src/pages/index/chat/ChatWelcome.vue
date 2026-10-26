<script setup lang="ts">
import CompanionAvatar from '../../../components/CompanionAvatar.vue'
import {computed} from 'vue'
import ChatMessageItem from './ChatMessage.vue'
import {welcomeMessage} from '../../../chat-welcome'
import SvgIcon from '../../../components/SvgIcon.vue'
import ChatExploreVisual from './ChatExploreVisual.vue'
import type { ChatEntry } from '../../../chat-entry'
import type { Conversation } from '../../../domain'
import type { ResolvedVisual } from '../../../visual-library'
import type { BloomStatus } from '../../../bloom-status'

defineOptions({ options: { styleIsolation: 'apply-shared' } })

const props=defineProps<{
  isDrafting: boolean
  activeConversation: Conversation | null
  userSaveChat: boolean
  welcomeContext: string
  firstWelcome?: boolean
  welcomeHasContext?: boolean
  themeId?: string
  newChatStarters: readonly string[]
  chatStarters: readonly string[]
  chatEntry: ChatEntry
  sending: boolean
  busy: boolean
  foreground?: boolean
  starterHint: string
  visual?: ResolvedVisual | null
  bloomStatus?: BloomStatus
}>()
const emit = defineEmits<{ starter: [prompt: string] }>()
const welcome=computed(()=>welcomeMessage(!!props.welcomeHasContext))
</script>

<template>
  <view v-if="isDrafting" class="chat-welcome">
    <ChatMessageItem v-if="firstWelcome" :message="welcome" :index="-1" :is-last="true" :speaking="false" :foreground="foreground" :gaze-active="foreground && !busy" :user-avatar="''" :editable="false" :theme-id="themeId || 'light'" :bloom-status="bloomStatus" />
    <view v-else class="chat-welcome-intro">
      <view class="chat-welcome-avatar"><CompanionAvatar :size="32" state="idle" :follow-gaze="true" :foreground="foreground && !busy && !sending" :status="bloomStatus || 'online'" /></view>
      <text class="body-copy">想说什么，就从哪里说起，发送后这段对话才会被创建</text>
    </view>
    <ChatExploreVisual :visual="visual || null" />
    <text v-if="!userSaveChat" class="welcome-context">未开启聊天保存：这段对话的原文只在本次使用中可见，不会为你伪造可恢复的历史</text>
    <text v-if="welcomeContext && !firstWelcome" class="welcome-context">{{ welcomeContext }}</text>
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
    <ChatMessageItem v-if="firstWelcome" :message="welcome" :index="-1" :is-last="true" :speaking="false" :foreground="foreground" :gaze-active="foreground && !busy" :user-avatar="''" :editable="false" :theme-id="themeId || 'light'" :bloom-status="bloomStatus" />
    <view v-else class="chat-welcome-intro">
      <view class="chat-welcome-avatar"><CompanionAvatar :size="32" state="idle" :follow-gaze="true" :foreground="foreground && !busy && !sending" :status="bloomStatus || 'online'" /></view>
      <text class="body-copy">{{ chatEntry.introduction }}</text>
    </view>
    <ChatExploreVisual :visual="visual || null" />
    <text v-if="welcomeContext && !firstWelcome" class="welcome-context">{{ welcomeContext }}</text>
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

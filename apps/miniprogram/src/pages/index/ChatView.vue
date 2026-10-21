<script setup lang="ts">
import SvgIcon from '../../components/SvgIcon.vue'
import ChatHeader from './chat/ChatHeader.vue'
import ChatModePanel from './chat/ChatModePanel.vue'
import ChatWelcome from './chat/ChatWelcome.vue'
import ChatMessageItem from './chat/ChatMessage.vue'
import ChatPendingMessage from './chat/ChatPendingMessage.vue'
import ChatThinking from './chat/ChatThinking.vue'
import ChatProposalCard from './chat/ChatProposalCard.vue'
import ChatInsightCard from './chat/ChatInsightCard.vue'
import type { ChatEntry } from '../../chat-entry'
import type { ChatMessage, Conversation, Insight, PhaseChange, Suggestion } from '../../domain'
import type { SupportMode } from '../../onboarding'
import type { ConversationMenuAction } from '../../conversation-action'

defineOptions({ options: { styleIsolation: 'apply-shared' } })

defineProps<{
  busy: boolean
  sending: boolean
  generatingSummary: boolean
  activeConversation: Conversation | null
  isDrafting: boolean
  chatEntry: ChatEntry
  runningIds: string[]
  chatMenuOpen: boolean
  readOnlyConversation: boolean
  selectedMode: string
  chatError: string
  aiMode: string
  modePickerOpen: boolean
  messages: ChatMessage[]
  userSaveChat: boolean
  welcomeContext: string
  newChatStarters: readonly string[]
  chatStarters: readonly string[]
  starterHint: string
  userAvatar: string
  speakingIndex: number | null
  olderCursor: string | null
  pendingText: string
  suggestion: Suggestion | null
  insight: Insight | null
  insightReaction: string
  lastRequestId: string
  currentEnded: boolean
  phaseChange: PhaseChange | null
}>()

const emit = defineEmits<{
  back: []
  history: []
  toggleMenu: []
  menuAction: [action: ConversationMenuAction]
  dismissError: []
  recover: []
  resume: []
  selectMode: [mode: SupportMode]
  starter: [prompt: string]
  loadOlder: []
  openPhase: []
  reviewSuggestion: []
  reactInsight: [action: 'interested' | 'dismissed' | 'experiment']
  editMessage: [index: number]
}>()
</script>

<template>
  <view class="chat-content">
    <ChatHeader
      :busy="busy"
      :sending="sending"
      :active-conversation="activeConversation"
      :is-drafting="isDrafting"
      :chat-entry="chatEntry"
      :running-ids="runningIds"
      :chat-menu-open="chatMenuOpen"
      :read-only-conversation="readOnlyConversation"
      :selected-mode="selectedMode"
      @back="emit('back')"
      @history="emit('history')"
      @toggle-menu="emit('toggleMenu')"
      @menu-action="emit('menuAction', $event)"
    />
    <view v-if="chatError" class="notice chat-error"><text>{{ chatError }}</text><button class="notice-close" aria-label="关闭对话提示" @click="emit('dismissError')"><SvgIcon name="close" :size="18" /></button><button v-if="lastRequestId" class="text-button" :disabled="busy" @click="emit('recover')">查看这条请求的结果</button></view>
    <view v-if="readOnlyConversation" class="notice"><text>{{ currentEnded ? '所属探索已结束，恢复探索后可以继续' : '会话已归档，可以在会话面板恢复' }}</text><button v-if="currentEnded" class="text-button" @click="emit('resume')">恢复探索</button></view>
    <text v-if="aiMode === 'demo'" class="demo-chat-note">本地演示 · 以下回复为固定示例，不调用模型</text>
    <ChatModePanel
      v-if="modePickerOpen"
      :selected-mode="selectedMode"
      :busy="busy"
      :sending="sending"
      @select="emit('selectMode', $event)"
    />
    <ChatWelcome
      v-if="!messages.length"
      :is-drafting="isDrafting"
      :active-conversation="activeConversation"
      :user-save-chat="userSaveChat"
      :welcome-context="welcomeContext"
      :new-chat-starters="newChatStarters"
      :chat-starters="chatStarters"
      :chat-entry="chatEntry"
      :sending="sending"
      :busy="busy"
      :starter-hint="starterHint"
      @starter="emit('starter', $event)"
    />
    <button v-if="olderCursor" class="text-button" :disabled="busy" @click="emit('loadOlder')">加载更早的消息</button>
    <ChatMessageItem
      v-for="(message, index) in messages"
      :key="message.id || index"
      :message="message"
      :index="index"
      :is-last="index === messages.length - 1"
      :speaking="speakingIndex === index"
      :user-avatar="userAvatar"
      :editable="!busy && !sending && !readOnlyConversation && (!userSaveChat || !!message.id)"
      @edit="emit('editMessage', index)"
    />
    <button v-if="phaseChange && !sending" class="text-button review-phase-change" @click="emit('openPhase')">查看可能的方向变化</button>
    <ChatPendingMessage v-if="sending && !generatingSummary" :pending-text="pendingText" :user-avatar="userAvatar" />
    <ChatThinking v-if="sending" :generating-summary="generatingSummary" />
    <ChatProposalCard v-if="suggestion" :suggestion="suggestion" @review="emit('reviewSuggestion')" />
    <ChatInsightCard
      v-if="insight"
      :insight="insight"
      :sending="sending"
      :busy="busy"
      :reaction="insightReaction"
      @react="emit('reactInsight', $event)"
    />
  </view>
</template>

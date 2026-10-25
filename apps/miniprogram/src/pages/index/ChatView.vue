<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { chatAtmosphere } from '../../chat-atmosphere'
import { PERSPECTIVE_PROTOTYPE, publicPerspective, type PerspectiveAction } from '../../perspective-shift'
import SvgIcon from '../../components/SvgIcon.vue'
import ChatHeader from './chat/ChatHeader.vue'
import ChatModePanel from './chat/ChatModePanel.vue'
import ChatWelcome from './chat/ChatWelcome.vue'
import ChatMessageItem from './chat/ChatMessage.vue'
import ChatPendingMessage from './chat/ChatPendingMessage.vue'
import ChatThinking from './chat/ChatThinking.vue'
import type { ReplyPhase } from '../../chat-stream'
import ChatProposalCard from './chat/ChatProposalCard.vue'
import ChatInsightCard from './chat/ChatInsightCard.vue'
import type { ChatEntry } from '../../chat-entry'
import type { ChatMessage, Conversation, Insight, PhaseChange, Suggestion, PlanDraft } from '../../domain'
import type { SupportMode } from '../../onboarding'
import type { ConversationMenuAction } from '../../conversation-action'
import type { ResolvedVisual } from '../../visual-library'
import type { BloomStatus } from '../../bloom-status'

defineOptions({ options: { styleIsolation: 'apply-shared' } })

const props = defineProps<{
  busy: boolean
  foreground?: boolean
  sending: boolean
  generatingSummary: boolean
  activeConversation: Conversation | null
  isDrafting: boolean
  chatEntry: ChatEntry
  runningIds: string[]
  chatMenuOpen: boolean
  readOnlyConversation: boolean
  selectedMode: string
  aiMode: string
  bloomStatus: BloomStatus
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
  streamText: string
  replyPhase: ReplyPhase
  followLatest: boolean
  selectionOpen: boolean
  suggestion: Suggestion | null
  planDraft?: PlanDraft | null
  canSummarizePlan?: boolean
  insight: Insight | null
  insightReaction: string
  currentEnded: boolean
  phaseChange: PhaseChange | null
  perspectiveDisabled?: boolean
  perspectiveDismissed?: string[]
  exploreVisual?: ResolvedVisual | null
  themeId: string
}>()
const selectionIndex = ref<number | null>(null)
const atmosphere = computed(() => chatAtmosphere(props.themeId))
function selectMessage(index: number, active: boolean) {
  if (active) { selectionIndex.value = index; emit('selection', true) }
  else if (selectionIndex.value === index) { selectionIndex.value = null; emit('selection', false) }
}
watch(() => props.selectionOpen, value => { if (!value) selectionIndex.value = null })

const emit = defineEmits<{
  back: []
  history: []
  toggleMenu: []
  menuAction: [action: ConversationMenuAction]
  resume: []
  selectMode: [mode: SupportMode]
  starter: [prompt: string]
  loadOlder: []
  openPhase: []
  reviewSuggestion: []
  reviewPlan: []
  summarizePlan: []
  reactInsight: [action: 'interested' | 'dismissed' | 'experiment']
  editMessage: [index: number]
  askBloom: [text: string]
  selection: [value: boolean]
  jumpLatest: []
  perspective: [action: PerspectiveAction, index: number]
}>()
</script>

<template>
  <view class="chat-content">
    <image class="chat-atmosphere" :src="atmosphere" mode="aspectFill" aria-hidden="true" />
    <view class="chat-surface">
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
      v-if="!messages.length && !sending"
      :is-drafting="isDrafting"
      :foreground="foreground"
      :active-conversation="activeConversation"
      :user-save-chat="userSaveChat"
      :welcome-context="welcomeContext"
      :new-chat-starters="newChatStarters"
      :chat-starters="chatStarters"
      :chat-entry="chatEntry"
      :sending="sending"
      :busy="busy"
      :starter-hint="starterHint"
      :visual="exploreVisual || null"
      :bloom-status="bloomStatus"
      @starter="emit('starter', $event)"
    />
    <button v-if="olderCursor" class="text-button" :disabled="busy" @click="emit('loadOlder')">加载更早的消息</button>
    <ChatMessageItem
      v-for="(message, index) in messages"
      :key="message.id || index"
      :message="message"
      :index="index"
      :is-last="index === messages.length - 1"
      :gaze-active="index === messages.length - 1 && !sending && !busy"
      :foreground="foreground"
      :speaking="speakingIndex === index"
      :user-avatar="userAvatar"
      :theme-id="themeId"
      :editable="!busy && !sending && !readOnlyConversation && (!userSaveChat || !!message.id)"
      :selection-owner="selectionIndex === index"
      :perspective="PERSPECTIVE_PROTOTYPE && !perspectiveDisabled && !perspectiveDismissed?.includes(message.payload?.perspective_token || '') ? publicPerspective(message.payload?.perspective_shift, message.payload?.perspective_token, messages) : null"
      :perspective-busy="busy || sending || readOnlyConversation"
      :bloom-status="bloomStatus"
      @perspective="emit('perspective', $event, index)"
      @edit="emit('editMessage', index)"
      @ask="emit('askBloom', $event)" @selection="selectMessage(index,$event)"
    />
    <button v-if="phaseChange && !sending" class="text-button review-phase-change" @click="emit('openPhase')">查看可能的方向变化</button>
    <view v-if="sending && !generatingSummary" id="pending-message">
      <ChatPendingMessage :pending-text="pendingText" :user-avatar="userAvatar" />
    </view>
    <ChatThinking v-if="sending" :generating-summary="generatingSummary" :phase="replyPhase" :stream-text="streamText" />
    <button v-if="!followLatest && !selectionOpen" class="jump-latest" @click="emit('jumpLatest')" hover-class="pressed">
      <SvgIcon name="chevron" :size="13" /><text>回到最新</text>
    </button>
    <view v-if="!sending && !currentEnded && !readOnlyConversation && (planDraft || canSummarizePlan)" class="chat-plan-entry">
      <view v-if="planDraft" class="proposal-card">
        <text class="eyebrow">待你修改与确认</text><text class="body-copy">{{ planDraft.title }}</text>
        <text v-if="planDraft.text" class="body-copy">{{ planDraft.text }}</text>
        <text v-if="planDraft.next_step" class="body-copy">可选的下一步：{{ planDraft.next_step }}</text>
        <button class="text-button" @click="emit('reviewPlan')">自己改一改，确认加入 Plan</button>
      </view>
      <button v-else class="text-button" @click="emit('summarizePlan')" hover-class="pressed" :hover-start-time="0">请 Bloom 帮我整理成记录</button>
    </view>
    <ChatProposalCard v-if="suggestion && !planDraft" :suggestion="suggestion" @review="emit('reviewSuggestion')" />
    <ChatInsightCard
      v-if="insight"
      :insight="insight"
      :sending="sending"
      :busy="busy"
      :reaction="insightReaction"
      @react="emit('reactInsight', $event)"
    />
    </view>
  </view>
</template>

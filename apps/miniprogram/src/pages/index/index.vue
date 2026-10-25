<script setup lang="ts">
import { computed, provide, ref, watch } from 'vue'
import { onPageScroll } from '@dcloudio/uni-app'
import SvgIcon from '../../components/SvgIcon.vue'
import { ICON_PALETTE_KEY } from '../../icon-system'
import OnboardingFlow from '../../components/OnboardingFlow.vue'
import EntryWelcome from '../../components/EntryWelcome.vue'
import ConversationDrawer from '../../components/ConversationDrawer.vue'
import PhaseChangeReview from '../../components/PhaseChangeReview.vue'
import {themes} from '../../themes'
import {resolveExploreVisual} from '../../visual-library'
import {resolveBloomStatus} from '../../bloom-status'
import AppTopbar from './views/AppTopbar.vue'
import AppTabbar from './views/AppTabbar.vue'
import HomeView from './views/HomeView.vue'
import BloomMoment from './views/BloomMoment.vue'
import PlanView from './views/PlanView.vue'
import DiscoverView from './views/DiscoverView.vue'
import EmptyDashboard from './views/EmptyDashboard.vue'
import SettingsView from './views/SettingsView.vue'
import EntryStatus from './views/EntryStatus.vue'
import ChatView from './ChatView.vue'
import ChatComposer from './chat/ChatComposer.vue'
import SpeechConsentNotice from './chat/SpeechConsentNotice.vue'
import SpeechConsentModal from './modals/SpeechConsentModal.vue'
import {SPEECH_KEY} from '../../speech'
import EditCardModal from './modals/EditCardModal.vue'
import ExperimentModal from './modals/ExperimentModal.vue'
import FeedbackModal from './modals/FeedbackModal.vue'
import AiConsentModal from './modals/AiConsentModal.vue'
import AppearanceModal from './modals/AppearanceModal.vue'
import SupportModal from './modals/SupportModal.vue'
import PrivacyModal from './modals/PrivacyModal.vue'
import ConversationActionModal from './modals/ConversationActionModal.vue'
import EditMessageModal from './modals/EditMessageModal.vue'
import {useIndexPage} from './useIndexPage'
import {homeConversationFor} from '../../home-entry'

const {
  speech,
  user,
  demoCredential,
  userAvatar,
  avatarBusy,
  chooseAvatar,
  current,
  config,
  ready,
  screen,
  finishOpening,
  beginOnboarding,
  pauseOnboarding,
  keyboardHeight,
  statusHeight,
  capsuleBottom,
  tab,
  modal,
  operations,
  busy,
  error,
  authError,
  chatError, composerError,
  offline,
  toast,
  preview,
  activeTheme,
  activeThemeStyle,
  dark,
  applyingTheme,
  themeAuto,
  themeAutoBusy,
  nextThemeBoundary,
  toggleThemeAuto,
  navImages,
  card,
  workspace,
  editMessage,
  saveMessageEdit,
  conversations,
  activeConversation,
  isDrafting,
  drawer,
  phaseError,
  skipPhaseChange,
  savePhaseChange,
  runningIds,
  messages,
  draft,
  pendingText, streamText, replyPhase, followLatest, jumpLatest, askBloom, messageSelectionOpen, handleChatScroll, composerHeight,
  sending,
  creatingConversation,
  suggestion,
  insight,
  insightReaction,
  generatingSummary,
  readOnlyConversation,
  speakingIndex,
  experimentEditor,
  canSaveExperiment,
  selectedMode,
  welcomeContext,
  chatFooterNote,
  chatEntry,
  modePickerOpen,
  starterHint,
  chatMenuOpen,
  closeChatMenu,
  openChatMenu,
  startNewChat,
  chatMenuAction,
  conversationAction,
  chatStarters,
  reactToInsight,
  saveExperiment,
  feedbackText,
  feedbackKind,
  archives,
  usage,
  editor,
  clearSession,
  request,
  guarded,
  initialize,
  saveQuestions,
  authenticate,
  selectTab,
  openEditor,
  saveEditor,
  reloadVersion,
  saveFeedback,
  sendChat,
  cancelChat,
  consentAI,
  confirm,
  toggleSaveChat,
  setTheme,
  setSupportStyle,
  setChatMode,
  useChatStarter,
  updateDraft,
  toggleWebSearch,
  toggleAIConsent,
  endIssue,
  showHistory,
  refreshWorkspace,
  changedConversation,
  deletedConversation,
  selectConversation,
  selectExploration,
  resumeExploration,
  beginAnotherExploration,
  loadOlderMessages,
  generateSummary,
  reviewSummary,
  recoverReply,
  logOut,
  deleteAccount,
  explorePrompt,
  discovery,
  bloomMoment,
  spaceForeground,
  chatAboutMoment,
  newChatStarters,
  todayLabel,
  greeting,
  canonicalSupportStyle,
} = useIndexPage()
const homeConversation = computed(() => homeConversationFor(current.value, conversations.value, activeConversation.value?.id))
const homeReply = computed(() => {
  const conversation=homeConversation.value
  if(sending.value || !user.value?.save_chat || !conversation || activeConversation.value?.id!==conversation.id) return null
  const reply=[...messages.value].reverse().find(message=>message.role==='assistant'&&message.content.trim())
  return reply?{conversationId:conversation.id,content:reply.content}:null
})
const openingHomeChat = ref(false)
async function continueHomeChat() {
  if (openingHomeChat.value) return
  openingHomeChat.value = true
  try {
    if (homeConversation.value) await selectConversation(homeConversation.value)
    else await selectTab('chat')
  } finally { openingHomeChat.value = false }
}
// Keep scroll registration in the page entry: the Mini Program compiler uses
// this import to enable page-scroll lifecycle dispatch.
const discoverScrollTop = ref(0)
watch(tab, () => { discoverScrollTop.value = 0 }, { flush: 'sync' })
onPageScroll(event => {
  if (screen.value === 'space' && tab.value === 'discover') discoverScrollTop.value = event.scrollTop
  handleChatScroll(event)
})

provide(ICON_PALETTE_KEY, computed(() => activeTheme.value.palette))
provide(SPEECH_KEY, speech)
const exploreVisual = computed(() => resolveExploreVisual(activeTheme.value.id))
const meRecordsRevision = ref(0)
function meContextChanged() { workspace.cancelAll(); meRecordsRevision.value++ }

const bloomStatus = computed(() => resolveBloomStatus(sending.value, offline.value || !!chatError.value))
</script>

<template>
  <view class="preview-stage"
        :class="['theme-' + activeTheme.id, { dark, 'theme-space': screen === 'space', 'theme-home': screen === 'space' && tab === 'now', 'theme-reflection': screen === 'space' && (tab === 'plan' || tab === 'discover'), 'keyboard-open': keyboardHeight > 0 }]"
        :style="{ ...activeThemeStyle, '--keyboard-height': `${keyboardHeight}px`, '--chat-dock-height': `${composerHeight}px`, '--status-bar-height': `${statusHeight}px`, '--capsule-bottom': `${capsuleBottom}px` }">
    <view class="app-shell"
          :class="{ 'with-tabs': screen === 'space', 'compact-tabs': screen === 'space' && ['discover', 'settings', 'plan'].includes(tab), 'chat-page': tab === 'chat' && screen === 'space', 'onboarding-shell': screen !== 'space' }">
      <view v-if="screen === 'space'" class="theme-atmosphere" :class="{ 'theme-atmosphere-faint': tab !== 'now' }" aria-hidden="true">
        <image :src="activeTheme.image" mode="aspectFill"/><view class="theme-atmosphere-wash"/>
      </view>
      <view v-if="screen === 'space' && (tab === 'plan' || tab === 'discover')" class="reflection-status-cover" :class="{ 'discover-status-cover': tab === 'discover' }" aria-hidden="true" />
      <AppTopbar v-if="screen === 'space' && tab !== 'chat'" :dark="dark" @history="showHistory"
                 @settings="selectTab('settings')" />
      <view v-if="error && !modal && screen === 'space' && !(tab === 'chat' && (current || isDrafting))" class="notice error-notice">
        <text>{{ error }}</text>
        <button v-if="!ready" class="text-button" @click="initialize" hover-class="pressed" :hover-start-time="0"
                :hover-stay-time="70">重新连接
        </button>
        <button class="notice-close" aria-label="关闭提示" @click="error = ''" hover-class="pressed"
                :hover-start-time="0" :hover-stay-time="70">
          <SvgIcon name="close" :size="20"/>
        </button>
      </view>

      <EntryStatus v-if="screen === 'restore'" :offline="offline" :error="error" :busy="busy"
                   :init-busy="operations.busy.init" :init-error="operations.errors.init"
                   @retry="initialize" @logout="clearSession" />
      <EntryWelcome v-else-if="screen === 'opening' || screen === 'auth'" :opening="screen === 'opening'"
        :auth="{ theme: activeTheme, busy, error: authError, devAuth: config.dev_auth, hasDemo: !!demoCredential,
          wechatAuth: config.wechat_auth, offline, connecting: operations.busy.init, ready }"
        @start="finishOpening" @login="authenticate"
        @replay="screen = 'opening'" @privacy="modal = 'privacy'" @retry="initialize" />
      <OnboardingFlow v-else-if="screen === 'onboard' && user" :key="user.id" :user-id="user.id"
        :busy="busy" :error="authError" @save="saveQuestions" @skip="pauseOnboarding"
        @privacy="modal = 'privacy'" @chat="selectTab('chat')" @navigate="operations.clear('auth')" />

      <template v-else-if="screen === 'space'">
        <HomeView v-if="tab === 'now'" :card="card" :current="current" :greeting="greeting" :foreground="spaceForeground"
                  :today-label="todayLabel" :conversation="homeConversation" :reply="homeReply" :retain-chat="!!user?.save_chat" :opening-chat="openingHomeChat"
                  @open-editor="openEditor()" @plan="selectTab('plan')"
                  @feedback="modal = 'feedback'" @chat="continueHomeChat" @onboarding="beginOnboarding" @context="drawer = 'snapshots'" />
        <PlanView v-else-if="current && tab === 'plan'" :current="current" :card="card" :theme-id="activeTheme.id"
                  @open-editor="openEditor()" @feedback="modal = 'feedback'" @chat="selectTab('chat')"
                  @resume="resumeExploration" @end="endIssue" />
        <ChatView :foreground="spaceForeground" v-else-if="(current || isDrafting) && tab === 'chat'" :busy="busy" :sending="sending"
                  :generating-summary="generatingSummary" :active-conversation="activeConversation"
                  :is-drafting="isDrafting" :chat-entry="chatEntry" :running-ids="runningIds"
                  :chat-menu-open="chatMenuOpen" :read-only-conversation="readOnlyConversation"
                  :selected-mode="selectedMode" :ai-mode="config.ai_mode"
                  :bloom-status="bloomStatus"
                  :mode-picker-open="modePickerOpen" :messages="messages" :user-save-chat="!!user?.save_chat"
                  :welcome-context="welcomeContext" :new-chat-starters="newChatStarters"
                  :chat-starters="chatStarters" :starter-hint="starterHint" :user-avatar="userAvatar"
                  :speaking-index="speakingIndex" :older-cursor="workspace.active.value.olderCursor.value"
                  :stream-text="streamText" :reply-phase="replyPhase" :follow-latest="followLatest" :selection-open="messageSelectionOpen"
                  @jump-latest="jumpLatest" @ask-bloom="askBloom" @selection="messageSelectionOpen = $event"
                  :pending-text="pendingText" :suggestion="suggestion" :insight="insight"
                  :insight-reaction="insightReaction"
                  :current-ended="!!current?.ended_at" :phase-change="workspace.active.value.phaseChange.value"
                  @back="tab = 'now'" @history="showHistory"
                  @toggle-menu="chatMenuOpen ? closeChatMenu() : openChatMenu()" @menu-action="chatMenuAction"
                  @resume="resumeExploration" @select-mode="setChatMode"
                  @starter="useChatStarter" @load-older="loadOlderMessages"
                  :perspective-disabled="workspace.active.value.perspectiveDisabled.value"
                  :perspective-dismissed="workspace.active.value.perspectiveDismissed.value"
                  :explore-visual="exploreVisual" :theme-id="activeTheme.id"
                  @perspective="(action, index) => workspace.active.value.reactToPerspective(action, index)"
                  @edit-message="editMessage"
                  @open-phase="phaseError = ''; workspace.active.value.phaseOpen.value = true"
                  @review-suggestion="openEditor(true)" @react-insight="reactToInsight" />
        <view v-if="tab === 'chat'" id="chat-bottom" :style="{ height: `${composerHeight + keyboardHeight}px` }" />
        <ChatComposer v-if="(current || isDrafting) && tab === 'chat' && !modal" :draft="draft" :sending="sending"
                      :creating="creatingConversation" :sending-started-at="workspace.active.value.sendingStartedAt.value" :generating-summary="generatingSummary"
                      :read-only-conversation="readOnlyConversation" :active-conversation="activeConversation"
                      :is-drafting="isDrafting" :web-search-on="workspace.active.value.webSearchOn.value"
                      :selected-quote="workspace.active.value.selectedQuote.value" @clear-quote="workspace.active.value.selectedQuote.value = ''"
                      :error="composerError" :recoverable="!!workspace.active.value.errorRequestId.value"
                      :recovery-busy="busy || sending || offline" @recover="recoverReply"
                      @dismiss-error="workspace.active.value.error.value = ''; workspace.active.value.errorRequestId.value = ''; operations.clear('ai'); error = ''; speech.dismissError()"
                      :chat-footer-note="chatFooterNote" @draft-change="updateDraft" @toggle-web="toggleWebSearch"
                      @send="sendChat" @cancel="cancelChat" @focus="messageSelectionOpen = false" @layout="composerHeight = $event">
          <template #notice><SpeechConsentNotice /></template>
        </ChatComposer>
        <DiscoverView v-else-if="tab === 'discover'" :scroll-top="discoverScrollTop" :theme-id="activeTheme.id" :recommendations="discovery.recommendations.value"
                      :loading="discovery.loading.value" :error="discovery.error.value" :loaded="discovery.loaded.value"
                      @explore="explorePrompt" @dismiss="discovery.dismiss" @rotate="discovery.rotate" @retry="discovery.load">
          <template #moment>
            <BloomMoment :foreground="spaceForeground" :moment="bloomMoment.moment.value" :day="bloomMoment.day.value" :theme-id="activeTheme.id"
              :loading="bloomMoment.loading.value" :generating="bloomMoment.generating.value" :error="bloomMoment.error.value"
              :personalize="bloomMoment.personalize.value" :can-personalize="!!user?.use_memory" :retained="!!user?.save_chat"
              :consent-open="bloomMoment.consentOpen.value" :demo="config.ai_mode === 'demo'"
              @open="bloomMoment.open" @dismiss="bloomMoment.dismiss" @chat="chatAboutMoment"
              @personalize="bloomMoment.personalize.value = !bloomMoment.personalize.value"
              @consent="bloomMoment.consent" @decline="bloomMoment.consentOpen.value = false" @recover="bloomMoment.load" />
          </template>
        </DiscoverView>
        <EmptyDashboard v-else-if="!current && tab !== 'settings' && tab !== 'now'" :tab="tab" :busy="busy"
                        @onboarding="beginOnboarding" @history="showHistory" @chat="selectTab('chat')" />
        <SettingsView v-else-if="tab === 'settings'" :current="current" :request="request" :records-revision="meRecordsRevision" @context-changed="meContextChanged" @user-changed="user = $event" :user="user" :user-avatar="userAvatar"
                      @speech="speech.manage()"
                      :avatar-busy="avatarBusy" :active-theme="activeTheme" :busy="busy" :usage="usage"
                      :theme-auto="themeAuto" :theme-busy="themeAutoBusy" :next-theme-boundary="nextThemeBoundary"
                      :ai-mode="config.ai_mode" :dev-auth="config.dev_auth" @restart-demo="logOut(true)" @appearance="modal = 'appearance'" @toggle-theme-auto="toggleThemeAuto"
                      @toggle-save="toggleSaveChat"
                      @toggle-ai="toggleAIConsent" @support="modal = 'support'" @direction="drawer = 'direction'"
                      @memories="drawer = 'memories'" @privacy="modal = 'privacy'" @logout="logOut"
                      @delete-account="deleteAccount" @choose-avatar="chooseAvatar"
                      @avatar-error="userAvatar = ''" />
        <AppTabbar v-if="tab !== 'chat'" :tab="tab" :nav-images="navImages" @select="selectTab" />
      </template>

      <EditCardModal v-if="modal === 'edit'" :busy="busy" :error="error" :editor="editor"
                     @close="modal = ''" @save="saveEditor" @reload="reloadVersion" />
      <ExperimentModal v-if="modal === 'experiment'" :busy="busy" :error="error"
                       :can-save="canSaveExperiment" :editor="experimentEditor" @close="modal = ''"
                       @save="saveExperiment" />
      <FeedbackModal v-if="modal === 'feedback'" :busy="busy" :error="error" :kind="feedbackKind"
                     :text="feedbackText" @kind-change="feedbackKind = $event"
                     @text-change="feedbackText = $event" @close="modal = ''" @save="saveFeedback" />
      <AiConsentModal v-if="modal === 'ai'" :ai-mode="config.ai_mode" :busy="busy" :error="error"
                      @close="modal = ''" @consent="consentAI" />
      <AppearanceModal v-if="modal === 'appearance'" :themes="themes" :active-theme="activeTheme"
                       :applying-theme="applyingTheme" :busy="!!applyingTheme" :theme-auto="themeAuto"
                       :next-theme-boundary="nextThemeBoundary" :error="error" @close="modal = ''"
                       @select="setTheme" />
      <SupportModal v-if="modal === 'support'" :busy="busy" :sending="sending" :error="error"
                    :selected="canonicalSupportStyle(user?.support_style)" @close="modal = ''"
                    @select="setSupportStyle" />
      <PrivacyModal v-if="modal === 'privacy'" :busy="busy" :error="error" @close="modal = ''" />
      <ConversationActionModal v-if="conversationAction"
                               :key="conversationAction.conversation.id + conversationAction.action"
                               :action="conversationAction.action" :conversation="conversationAction.conversation"
                               :request="request" @close="conversationAction = null"
                               @changed="changedConversation" @deleted="deletedConversation" />
      <EditMessageModal v-if="workspace.active.value.editIndex.value !== null"
                        :text="workspace.active.value.editText.value" :busy="sending"
                        :error="workspace.active.value.error.value" :retained="!!user?.save_chat"
                        @change="workspace.active.value.editText.value = $event"
                        @close="workspace.active.value.closeEdit()" @save="saveMessageEdit" @cancel="cancelChat" />

      <PhaseChangeReview v-if="workspace.active.value.phaseOpen.value && workspace.active.value.phaseChange.value" :key="workspace.activeId.value + workspace.active.value.phaseChange.value.source_id"
                         :change="workspace.active.value.phaseChange.value" :confirmed="workspace.active.value.phaseConfirmed.value" :busy="busy" :error="phaseError"
                         @confirm="workspace.active.value.confirmPhaseChange()" @skip="skipPhaseChange" @close="workspace.active.value.phaseOpen.value = false" @save="savePhaseChange" />
      <ConversationDrawer v-if="drawer && user" :key="user.id" :view="drawer" :conversations="conversations" :active="activeConversation" :issues="archives" :user="user" :initial-issue-id="current?.id"
                          :summary="workspace.active.value.summary.value" :summary-draft="workspace.active.value.summaryDraft.value"
                          :generating="sending" :running="runningIds" :error="chatError || error" :request="request"
                          @close="drawer = ''" @view-changed="drawer = $event" @select="selectConversation" @refresh="guarded(refreshWorkspace)"
                          @create-issue="beginAnotherExploration" @select-issue="selectExploration" @generate="generateSummary" @reviewed="reviewSummary"
                          @new-chat="startNewChat"
                          @changed="changedConversation" @deleted="deletedConversation" @user-changed="user = $event" @context-changed="meContextChanged" />
      <SpeechConsentModal />
      <view v-if="toast" class="toast">{{ toast }}</view>
    </view>
  </view>
</template>
<style scoped>
.entry-status { padding:calc(var(--capsule-bottom,64px) + 80px) 32px 40px; }
.entry-status .page-title { margin:24px 0; font-size:28px; }
.entry-status .action-button { margin-top:28px; }
</style>

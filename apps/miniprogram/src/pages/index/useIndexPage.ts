import { createChatFollow } from '../../chat-follow'
import {computed, nextTick, onMounted, onUnmounted, reactive, ref, toRaw, watch} from 'vue'
import {onHide, onReady, onShow} from '@dcloudio/uni-app'
import {makePreview, mergeSuggestion, experimentProposal} from '../../domain'
import {newOnboarding, canonicalSupportStyle} from '../../onboarding'
import type {SupportMode} from '../../onboarding'
import {chatEntryFor} from '../../chat-entry'
import { OPENING_KEY, initialScreen, signedInScreen, draftKeyFor, pauseKeyFor } from '../../entry'
import type { EntryScreen } from '../../entry'
import {navigationItems, resolveTheme, themeForSession, themeStyle, themeNavSvg} from '../../themes'
import type {ThemeId, SpaceTab} from '../../themes'
import type {Card, ChatMessage, Issue, Onboarding, User, Experiment, Conversation, ConversationSummary} from '../../domain'
import {ApiError, createApi} from '../../http'
import {createNativeSpeech} from '../../native-speech'
import {createOperationState} from '../../operations'
import type {OperationScope} from '../../operations'
import {createChatWorkspace} from '../../chat-workspace'
import {createDraftSync, type DraftSourceRef} from '../../chat-drafts'
import {createChatHandoff, combineDrafts} from '../../chat-handoff'
import {CHAT_INPUT_LIMIT} from '../../chat-limits'
import { createOnboardingProgress } from '../../onboarding-progress'
import {useBloomMoment, momentDraft} from '../../bloom-moment'
import {useDiscovery} from '../../use-discovery'
import {discoveryStateKey} from '../../discovery'
import { discoveryDraft, discoveryQuotedEvidence, discoveryDestination, type DiscoveryAngle } from '../../discover-angles'
import type {ConversationAction, ConversationMenuAction} from '../../conversation-action'
import {createAvatarStore} from '../../avatar'
import {createThemePreference, formatThemeBoundary, personalSpaceTheme} from '../../theme-preference'
import {createThemeClock} from '../../theme-clock'
import {createThemePaintCache} from '../../theme-paint'
import {newChatStarters, editFields, todayLabel, greeting} from './data'
import { usePlan } from '../../use-plan'
import { homeConversationFor } from '../../home-entry'


export function useIndexPage() {
  const token = ref<string>(uni.getStorageSync('agency.session') || '')
  const user = ref<User | null>(null)
  const DEMO_KEY = 'agency.demo.credential.v1'
  const storedDemo = uni.getStorageSync(DEMO_KEY)
  const demoCredential = ref<{ userId: string; secret: string } | null>(
    storedDemo && typeof storedDemo.userId === 'string' && typeof storedDemo.secret === 'string'
      && /^[A-Za-z0-9_-]{40,128}$/.test(storedDemo.secret) ? storedDemo : null
  )
  function rememberDemo(userId: string, secret: string) {
    demoCredential.value = { userId, secret }
    try { uni.setStorageSync(DEMO_KEY, demoCredential.value) }
    catch { notify('已登录，但本机未能记住演示账号，请暂时不要退出') }
  }
  function forgetDemo() {
    demoCredential.value = null
    try { uni.removeStorageSync(DEMO_KEY) } catch { /* Server still rejects invalid credentials. */ }
  }
  const localAvatars = createAvatarStore({
    read: key => uni.getStorageSync(key) || '',
    write: (key, path) => path ? uni.setStorageSync(key, path) : uni.removeStorageSync(key),
    save: path => new Promise((resolve, reject) => uni.saveFile({
      tempFilePath: path,
      success: result => resolve(result.savedFilePath),
      fail: reject
    })),
    remove: path => new Promise((resolve, reject) => uni.removeSavedFile({
      filePath: path,
      success: () => resolve(),
      fail: reject
    })),
  })
  const userAvatar = ref('')
  const avatarBusy = ref(false)
  watch(() => user.value?.id, id => {
    userAvatar.value = id ? localAvatars.read(id) : ''
  })

  async function chooseAvatar(event: { detail: { avatarUrl?: string } }) {
    const id = user.value?.id, path = event.detail.avatarUrl
    if (!id || !path || avatarBusy.value) return
    avatarBusy.value = true
    try {
      await localAvatars.choose(id, path)
      if (user.value?.id === id) {
        userAvatar.value = localAvatars.read(id);
        notify('头像已更新，仅保存在这台设备')
      }
    } catch {
      notify('头像没有保存成功，原头像仍然保留')
    } finally {
      avatarBusy.value = false
    }
  }

  const current = ref<Issue | null>(null)
  const selectedConversationKey = (userId: string) => `agency.selected-conversation.v1:${userId}`
  const config = ref<{ dev_auth: boolean; wechat_auth?: boolean; ai_mode: string }>({dev_auth: false, ai_mode: 'demo'})
  const ready = ref(false)
  const screen = ref<EntryScreen>(initialScreen(!!token.value, !!uni.getStorageSync(OPENING_KEY)))
  function finishOpening() {
    try { uni.setStorageSync(OPENING_KEY, true) } catch { /* Presentation state is optional. */ }
    screen.value = 'auth'
  }
  function beginOnboarding() {
    if (!user.value) { screen.value = 'auth'; return }
    onboardingProgress.resume()
    try { uni.removeStorageSync(pauseKeyFor(user.value.id)) } catch { /* Continue in memory. */ }
    operations.clear('auth')
    screen.value = 'onboard'
  }
  function pauseOnboarding() {
    if (busy.value || !user.value) return
    onboardingProgress.pause()
    try { uni.setStorageSync(pauseKeyFor(user.value.id), true) } catch { /* Continue in memory. */ }
    screen.value = 'space'
    tab.value = 'now'
    void nextTick(() => uni.pageScrollTo({ scrollTop: 0, duration: 0 }))
  }
  const keyboardHeight = ref(0)
  const statusHeight = ref(0)
  const capsuleBottom = ref(0)
  // #ifdef MP-WEIXIN
  statusHeight.value = uni.getWindowInfo().statusBarHeight || 0
  capsuleBottom.value = uni.getMenuButtonBoundingClientRect().bottom
  const keyboardChanged = ({height}: { height: number }) => {
    keyboardHeight.value = height
  }
  uni.onKeyboardHeightChange(keyboardChanged)
  onUnmounted(() => uni.offKeyboardHeightChange(keyboardChanged))
  // #endif
  const tab = ref<SpaceTab>('now')
  const modal = ref<'' | 'privacy' | 'edit' | 'feedback' | 'ai' | 'appearance' | 'support' | 'experiment'>('')
  watch(modal, value => { if (value === 'ai') uni.hideKeyboard() })
  const operations = createOperationState()
  const busy = computed(() => operations.busy.auth || operations.busy.data)
  const error = computed({ get: () => operations.errors.data, set: value => { operations.errors.data = value } })
  const authError = computed(() => operations.errors.auth)
  const chatError = computed(() => workspace.active.value.error.value || operations.errors.ai)
  const composerError = computed(() => offline.value ? '网络连接已断开，输入仍保留，恢复网络后可以继续' : chatError.value || speech.error.value || error.value || draftSync.error(workspace.activeId.value))
  const offline = computed(() => !!operations.errors.init)
  const toast = ref('')
  const form = reactive<Onboarding>(newOnboarding())
  const onboardingProgress = createOnboardingProgress({
    storage: { read: key => uni.getStorageSync(key), write: (key, value) => uni.setStorageSync(key, value), remove: key => uni.removeStorageSync(key) },
    transport: { get: () => request('GET', '/onboarding-progress'), save: body => request('PUT', '/onboarding-progress', body) },
  })
  watch(() => `${user.value?.id || ''}:${token.value}`, () => {
    onboardingProgress.reset(token.value && user.value ? user.value.id : '')
  }, { flush: 'sync' })
  const onboardingNetworkChanged = ({ isConnected }: { isConnected: boolean }) => {
    if (isConnected && user.value) void refreshOnboardingProgress()
  }
  async function refreshOnboardingProgress() {
    const account = user.value?.id
    await onboardingProgress.retry()
    if (account && account === user.value?.id && onboardingProgress.isCompleted() && screen.value === 'onboard' && !busy.value) await guarded(loadCurrent, 'auth')
  }
  async function restoreRemoteOnboarding() {
    const account = user.value?.id
    await onboardingProgress.useRemote()
    if (account && account === user.value?.id && onboardingProgress.isCompleted()) await guarded(loadCurrent, 'auth')
  }
  uni.onNetworkStatusChange(onboardingNetworkChanged)
  onHide(() => { void onboardingProgress.flush() })
  onShow(() => { if (user.value) void refreshOnboardingProgress() })
  onUnmounted(() => {
    uni.offNetworkStatusChange(onboardingNetworkChanged)
    void onboardingProgress.flush(); onboardingProgress.dispose()
  })
  const preview = computed(() => makePreview(form))
  const themePreference = createThemePreference({
    read: key => uni.getStorageSync(key),
    write: (key, value) => uni.setStorageSync(key, value),
    remove: key => uni.removeStorageSync(key),
  })
  const themePaint = createThemePaintCache({
    read: key => uni.getStorageSync(key),
    write: (key, value) => uni.setStorageSync(key, value),
    remove: key => uni.removeStorageSync(key),
  })
  const themeClock = createThemeClock()
  themeClock.start()
  onUnmounted(themeClock.stop)
  onHide(() => { themeClock.stop(); keyboardHeight.value = 0 })
  const themeSlot = themeClock.slot
  const themeAuto = computed(() => {
    const id = user.value?.id
    return !id || themePreference.isAuto(id)
  })
  const themeOverride = computed(() => {
    const id = user.value?.id
    return id ? themePreference.overrideFor(id, themeSlot.value.key) : null
  })
  const nextThemeBoundary = computed(() => formatThemeBoundary(themeSlot.value.end))
  const desiredTheme = computed(() => {
    // Account restoration can take a full network round trip. Its first view
    // uses the local paint hint rather than briefly rendering Morning Mist.
    if (screen.value === 'restore') return themePaint.read(token.value, themeSlot.value.start)
    if (screen.value !== 'space') return themeForSession(user.value, false)
    return personalSpaceTheme(user.value, {
      auto: themeAuto.value,
      overrideTheme: themeOverride.value,
      slot: themeSlot.value,
    })
  })
  const activeThemeId = ref<ThemeId>(desiredTheme.value.id)
  const activeTheme = computed(() => resolveTheme(activeThemeId.value))
  function applyDesiredTheme(force = false) {
    // Do not repaint a focused composer at a time boundary. The latest policy
    // applies as soon as the keyboard closes.
    if (!force && keyboardHeight.value > 0) return
    activeThemeId.value = desiredTheme.value.id
  }
  watch([() => desiredTheme.value.id, keyboardHeight], () => applyDesiredTheme(), { immediate: true })
  watch([() => user.value?.id, () => screen.value], () => applyDesiredTheme(true))
  watch([() => user.value?.id, () => themeSlot.value.key], ([id, slot]) => {
    if (id) themePreference.pruneOverride(id, slot)
  }, { immediate: true })
  const activeThemeStyle = computed(() => themeStyle(activeTheme.value))
  watch([activeTheme, themeAuto, themeOverride, () => themeSlot.value.end, () => screen.value], () => {
    if (screen.value === 'space' && user.value && token.value) {
      themePaint.remember(token.value, activeTheme.value.id, themeAuto.value, themeOverride.value ? themeSlot.value.end : 0)
    }
    // #ifdef H5
    if (typeof document !== 'undefined') {
      const root = document.documentElement.style
      root.setProperty('--startup-bg', activeTheme.value.palette.bg)
      root.setProperty('--startup-ink', activeTheme.value.palette.ink)
      root.backgroundColor = activeTheme.value.palette.bg
      root.colorScheme = activeTheme.value.dark ? 'dark' : 'light'
    }
    // #endif
  }, { immediate: true })
  const dark = computed(() => activeTheme.value.dark)
  const applyingTheme = ref<ThemeId | null>(null)
  const themeAutoBusy = ref(false)
  const navImages = computed(() => Object.fromEntries(navigationItems.map(({ id }) => {
    const svg = themeNavSvg(activeTheme.value, id, tab.value === id)
    const bytes = new Uint8Array([...svg].map(char => char.charCodeAt(0)))
    return [id, 'data:image/svg+xml;base64,' + uni.arrayBufferToBase64(bytes.buffer)]
  })))

  // #ifdef MP-WEIXIN
  function syncStatusBar() {
    uni.setNavigationBarColor({
      frontColor: dark.value ? '#ffffff' : '#000000',
      backgroundColor: activeTheme.value.palette.bg,
    })
    uni.setBackgroundColor?.({
      backgroundColor: activeTheme.value.palette.bg,
      backgroundColorTop: activeTheme.value.palette.bg,
      backgroundColorBottom: activeTheme.value.palette.bg,
    })
  }

  onReady(syncStatusBar)
  watch(activeTheme, syncStatusBar)
  // #endif
  const card = computed(() => current.value?.card ?? preview.value)
  const workspace = createChatWorkspace({
    post: (conversationId, body, onEvent) => api.request('POST', `/conversations/${conversationId}/chat`, body, onEvent),
    cancelRemote: id => request('POST', `/requests/${id}/cancel`),
    requestId,
    onError: () => {},
    onCancelled: message => notify(message),
  })
  const conversations = ref<Conversation[]>([])
  const chatHandoff = createChatHandoff()
  const newExplorationOpen = ref(false), newExplorationDraft = reactive({ title:'', background:'' })
  let newExplorationRequest = '', newExplorationPayload = ''
  let navigationRevision = 0, openingHandoff = false
  watch([() => user.value?.id, token], () => {
    navigationRevision++; chatHandoff.cancel(); newExplorationOpen.value = false
    newExplorationDraft.title = ''; newExplorationDraft.background = ''
    newExplorationRequest = ''; newExplorationPayload = ''
  }, { flush: 'sync' })
  onUnmounted(chatHandoff.cancel)
  const draftSync = createDraftSync({
    list: () => request('GET', '/chat-drafts'),
    save: (key, body) => request('PUT', `/chat-drafts/${encodeURIComponent(key)}`, body),
  })
  let restoringDrafts = false
  watch(() => `${user.value?.id || ''}:${!!user.value?.save_chat}:${token.value}`, () => {
    draftSync.reset(user.value?.save_chat ? user.value.id : '')
  }, { flush: 'sync' })
  function syncComposerDrafts() {
    if (restoringDrafts) return
    for (const [key, session] of Object.entries(workspace.sessions)) {
      const issueId = workspace.drafts[key]?.issueId ?? conversations.value.find(c => c.id === key)?.issue_id ?? null
      draftSync.set(key, session.draft.value, issueId, discoveryDrafts.get(key) || [])
    }
  }
  watch(() => Object.entries(workspace.sessions).map(([key, session]) => [key, session.draft.value]), syncComposerDrafts, { flush: 'sync' })
  async function restoreComposerDrafts() {
    const account = user.value?.id, credential = token.value
    restoringDrafts = true
    try {
      const rows = await draftSync.load()
      if (user.value?.id !== account || token.value !== credential) return
      for (const row of rows) {
        if (!row.content) continue
        const sources: DraftSourceRef[] = []
        let withdrawn = false
        for (const source of row.source_refs || []) {
          let valid = false
          try { valid = !!await discovery.verify({id:source.id,issueId:source.issue_id,strategy:source.strategy}) } catch { /* An unavailable source is not reused. */ }
          if (user.value?.id !== account || token.value !== credential) return
          if (valid) sources.push(source)
          else { row.content = removeSourceText(row.content, source); withdrawn = true }
        }
        if (sources.length) discoveryDrafts.set(row.key, sources)
        if (withdrawn) workspace.get(row.key).error.value = '一条带入线索已不可用，已撤下原文，请检查草稿后发送'
        if (row.key.startsWith('draft:')) {
          workspace.restoreDraft(row.key, row.issue_id, row.content)
          if (!openedIds.value.includes(row.key)) openedIds.value.push(row.key)
        }
        else if (conversations.value.some(c => c.id === row.key)) {
          const session = workspace.get(row.key)
          if (!session.draft.value) session.draft.value = row.content
        }
      }
    } finally { restoringDrafts = false }
    syncComposerDrafts()
  }
  onHide(() => { syncComposerDrafts(); void draftSync.flush() })
  onShow(() => {
    if (user.value?.save_chat && !draftSync.ready() && !restoringDrafts) void restoreComposerDrafts()
    else { syncComposerDrafts(); void draftSync.flush() }
  })
  onUnmounted(() => { void draftSync.flush(); draftSync.reset('') })
  const activeConversation = computed(() => conversations.value.find(c => c.id === workspace.activeId.value) || null)
  // A draft shell can retain unsent text without creating a conversation or AI turn.
  const DRAFT_PREFIX = 'draft:'
  const isDraftKey = (id: string) => id.startsWith(DRAFT_PREFIX)
  const isDrafting = computed(() => isDraftKey(workspace.activeId.value))
  const creatingDrafts = ref<string[]>([])
  const draftCreationCancelled = new Set<string>()
  const drawer = ref<'' | 'list' | 'summary' | 'memories' | 'direction' | 'details' | 'snapshots'>('')
  const historyLoading = ref(false), historyError = ref('')
  // #ifdef H5
  watch(drawer, value => document.documentElement.classList.toggle('conversation-drawer-open', !!value), { flush: 'sync' })
  onUnmounted(() => document.documentElement.classList.remove('conversation-drawer-open'))
  // #endif
  const phaseError = ref('')
  async function skipPhaseChange() {
    const session = workspace.active.value, candidate = session.phaseChange.value, conversation = activeConversation.value
    if (busy.value || !candidate || !conversation) return
    session.skipPhaseChange()
    await guarded(async () => {
      try {
        const updated = await request<Conversation>('PUT', `/conversations/${conversation.id}`, {
          version: conversation.version,
          dismissed_change_ids: [...new Set([...(conversation.dismissed_change_ids || []), candidate.source_id])].slice(-40),
        })
        changedConversation(updated)
      } catch { notify('本次已跳过，未能保存跨次不再提示的设置') }
    })
  }
  async function savePhaseChange(content: string, keepHistory: boolean) {
    const sourceConversationId = activeConversation.value?.id || null
    const session = workspace.active.value, candidate = session.phaseChange.value
    if (!candidate || !session.phaseConfirmed.value || busy.value) return
    phaseError.value = ''
    await guarded(async () => {
      try {
        const path = candidate.source_kind === 'memory' ? `/memories/${candidate.source_id}/replace` : `/issues/${candidate.source_id.replace('snapshot:', '')}/phase`
        await request('POST', path, { content, version: candidate.source_version, confirmed: true, keep_history: keepHistory, source_conversation_id: sourceConversationId })
        session.skipPhaseChange(); workspace.cancelAll(); await refreshWorkspace(); notify('已保存你确认的当前方向')
      } catch (e) { phaseError.value = e instanceof Error ? e.message : '保存未完成，请稍后重试'; throw e }
    })
  }
  const openedIds = ref<string[]>([])
  const runningIds = computed(() => Object.entries(workspace.sessions).filter(([, session]) => session.sending.value).map(([id]) => id))
  const messages = computed({ get: () => workspace.active.value.messages.value, set: value => { workspace.active.value.messages.value = value } })
  const draft = computed({ get: () => workspace.active.value.draft.value, set: value => { workspace.active.value.draft.value = value } })
  const api = createApi(options => uni.request({...options, success: options.success, fail: options.fail}),
      () => token.value, clearSession, import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api')
  const speech = createNativeSpeech(api, () => token.value, () => workspace.activeId.value,
      import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api')
  watch(() => [workspace.activeId.value, tab.value, user.value?.save_chat, user.value?.id], () => speech.stop())
  watch(() => messages.value.map(message => message.id + ':' + message.content).join('\n'), () => speech.stop())
  onHide(speech.stop)
  onUnmounted(speech.reset)

  const pendingText = computed({ get: () => workspace.active.value.pendingText.value, set: value => { workspace.active.value.pendingText.value = value } })
  const creatingConversation = computed(() => creatingDrafts.value.includes(workspace.activeId.value))
  const sending = computed(() => workspace.active.value.sending.value)
  const streamText = computed(() => workspace.active.value.streamText.value)
  const replyPhase = computed(() => workspace.active.value.replyPhase.value)
  const follow = createChatFollow(), followLatest = ref(true)
  const composerHeight = ref(112)
  let scrollTimer: ReturnType<typeof setTimeout> | undefined
  let scrollRevision = 0
  function jumpLatest() {
    follow.resume(); followLatest.value = true
    if (tab.value !== 'chat') return
    void nextTick(() => { if (follow.following && tab.value === 'chat') uni.pageScrollTo({ scrollTop: 10000000, duration: 0 }) })
  }
  function followReply() {
    if (!follow.following || tab.value !== 'chat' || scrollTimer) return
    scrollTimer = setTimeout(() => { scrollTimer = undefined; if (follow.following) jumpLatest() }, 100)
  }
  function handleChatScroll(event: { scrollTop: number }) {
    if (tab.value !== 'chat') return
    // Pause synchronously: a delayed native geometry callback must not race
    // the next streamed chunk and pull the reader back to the bottom.
    const revision = ++scrollRevision
    follow.scroll(event.scrollTop, false)
    followLatest.value = follow.following
    uni.createSelectorQuery().select('#chat-bottom').boundingClientRect(rect => {
      if (!rect || Array.isArray(rect) || revision !== scrollRevision) return
      const height = uni.getSystemInfoSync().windowHeight
      follow.scroll(event.scrollTop, (rect.bottom ?? Infinity) <= height + 80)
      followLatest.value = follow.following
    }).exec()
  }
  watch(sending, value => {
    if (!value || tab.value !== 'chat' || workspace.active.value.sendingTask.value === 'summary') return
    uni.hideKeyboard(); jumpLatest()
  })
  watch(streamText, followReply)
  watch(composerError, followReply)
  watch([composerHeight, keyboardHeight], followReply)
  watch(() => [workspace.activeId.value, tab.value], () => {
    follow.reset(); followLatest.value = true
    if (tab.value === 'chat') followReply()
  })
  onUnmounted(() => { if (scrollTimer) clearTimeout(scrollTimer) })
  const suggestion = computed({ get: () => workspace.active.value.suggestion.value, set: value => { workspace.active.value.suggestion.value = value } })
  const insight = computed({ get: () => workspace.active.value.insight.value, set: value => { workspace.active.value.insight.value = value } })
  const insightReaction = computed(() => workspace.active.value.insightReaction.value)
  const generatingSummary = computed(() => sending.value && workspace.active.value.sendingTask.value === 'summary')
  const readOnlyConversation = computed(() => !!activeConversation.value?.archived_at || !!current.value?.ended_at)
  // Brief speaking animation for a newly received reply.
  const speakingIndex = ref<number | null>(null)
  let speakingTimer: ReturnType<typeof setTimeout> | undefined
  watch(() => messages.value.length, (length, previous) => {
    if (length <= previous || tab.value !== 'chat' || messages.value[length - 1]?.role !== 'assistant') return
    if (speakingTimer) clearTimeout(speakingTimer)
    speakingIndex.value = length - 1
    speakingTimer = setTimeout(() => { speakingIndex.value = null }, 780)
  })
  onUnmounted(() => { if (speakingTimer) clearTimeout(speakingTimer) })
  watch(() => messages.value[messages.value.length - 1], followReply)
  const messageSelectionOpen = ref(false)
  watch(messageSelectionOpen, value => {
    if (!value) return
    follow.pause(); followLatest.value = false
    if (scrollTimer) { clearTimeout(scrollTimer); scrollTimer = undefined }
    uni.hideKeyboard()
  })
  function askBloom(text: string) {
    if (!text.trim() || sending.value) return
    if (text.length > 800) { notify('这段内容较长，请缩小选区后再问 Bloom'); return }
    workspace.active.value.selectedQuote.value = text
    messageSelectionOpen.value = false
    jumpLatest()
  }
  watch(() => workspace.activeId.value, () => { messageSelectionOpen.value = false })
  const experimentEditor = reactive<Experiment>({ action: '', tests: '', effort: '', stop_rule: '' })
  let experimentBase: Card | null = null
  let experimentVersion = 0
  const canSaveExperiment = computed(() => !!experimentEditor.action.trim() &&
    !!experimentBase && experimentProposal(experimentBase, experimentEditor).next_step.length <= 600)
  const selectedMode = computed(() => canonicalSupportStyle(activeConversation.value?.support_style || user.value?.support_style))
  const welcomeContext = computed(() => current.value?.focus_response || current.value?.actual_question || current.value?.background || '')
  const welcomeCompleted = ref(false)
  watch(() => user.value?.id, id => {
    try { welcomeCompleted.value = !!id && uni.getStorageSync('agency.welcome-completed.v1:'+id) === true }
    catch { welcomeCompleted.value = false }
  }, {flush:'sync'})
  const firstWelcome = computed(() => !welcomeCompleted.value && (isDrafting.value ? !conversations.value.length :
    conversations.value.length === 1 && activeConversation.value?.id === current.value?.id))
  const welcomeHasContext = computed(() => !!welcomeContext.value.trim() || !!current.value?.concerns?.length ||
    Object.values(current.value?.follow_ups || {}).some(answer => !!answer.note?.trim() || answer.selections.length > 0))
  // Composer footer: the model's own tailored line, falling back to the
  // user's direction/question. Retention status never takes this slot.
  const chatFooterNote = computed(() => {
    if (isDrafting.value) return current.value ? `新对话 · 关联${current.value.title || '当前探索'} · 发送后保存` : '发送后保存为新的探索与对话，问题可以自由修改'
    const trim = (text: string) => text.trim().replace(/[。．!！?？]+$/, '')
    const model = trim(workspace.active.value.tailLine.value)
    if (model) return model
    const question = trim(current.value?.actual_question || '')
    if (question) return `还想着「${question.length > 12 ? question.slice(0, 12) + '…' : question}」吗，可以接着聊`
    const title = trim(current.value?.title || '')
    if (title) return `沿着「${title.length > 10 ? title.slice(0, 10) + '…' : title}」继续，或换个话题`
    return '想到什么，都可以从这里说起'
  })
  const chatEntry = computed(() => chatEntryFor(selectedMode.value, current.value || {}))
  const modePickerOpen = ref(false)
  const starterHint = ref('')
  // The conversation title opens management; the left button remains navigation.
  const chatMenuOpen = ref(false)
  const conversationAction = ref<{ action: ConversationAction; conversation: Conversation } | null>(null)
  function closeChatMenu() { chatMenuOpen.value = false }
  function openChatMenu() { if (!chatMenuOpen.value) chatMenuOpen.value = true }
  // New ChatGPT-style draft shell: a clean welcome page that stays local until
  // the first real send, so abandoned opens never create empty conversations.
  function startNewChat() {
    navigationRevision++; chatHandoff.cancel()
    if (!user.value || current.value?.ended_at) return
    // Drop empty draft shells so repeated "new chat" taps don't accumulate.
    for (const key of Object.keys(workspace.sessions)) {
      if (isDraftKey(key) && !creatingDrafts.value.includes(key) && !workspace.sessions[key].messages.value.length && !workspace.sessions[key].draft.value.trim()) {
        workspace.remove(key)
        openedIds.value = openedIds.value.filter(id => id !== key)
      }
    }
    const key = workspace.startDraft(current.value?.id || null)
    if (!openedIds.value.includes(key)) openedIds.value.push(key)
    modePickerOpen.value = false; starterHint.value = ''; chatMenuOpen.value = false
    drawer.value = ''; tab.value = 'chat'
    void nextTick(() => uni.pageScrollTo({ scrollTop: 0, duration: 0 }))
  }
  function chatMenuAction(action: ConversationMenuAction) {
    chatMenuOpen.value = false
    if (busy.value) return
    if (action === 'preference') { modePickerOpen.value = true; return }
    if (action === 'summary') { drawer.value = 'summary'; return }
    if (action === 'details') { drawer.value = 'details'; return }
    const item = activeConversation.value
    if (!item || (action === 'archive' && item.archived_at)) return
    conversationAction.value = { action, conversation: { ...item } }
  }
  const chatStarters = computed(() => chatEntry.value.starters.slice(0, 2))
  watch(() => tab.value, closeChatMenu)
  watch(() => workspace.activeId.value, closeChatMenu)

  function reactToInsight(action: 'interested' | 'dismissed' | 'experiment') {
    if (busy.value || sending.value || !insight.value || !current.value) return
    const experiment = workspace.active.value.reactToInsight(action)
    if (action === 'dismissed') { notify('已略过这个角度，不会写入卡片'); return }
    if (action === 'experiment' && experiment) {
      Object.assign(experimentEditor, experiment)
      experimentBase = JSON.parse(JSON.stringify(current.value.card))
      experimentVersion = current.value.version
      error.value = ''; modal.value = 'experiment'
    } else notify(insightReaction.value === action ? '问题已带入输入框，你可以修改后再发送' : '输入框里已有较多内容，请先发送或调整后再继续')
  }
  async function saveExperiment() {
    if (!canSaveExperiment.value || !experimentBase || !current.value || !insight.value) return
    await guarded(async () => {
      current.value = await request<Issue>('PUT', `/issues/${current.value!.id}/card`, {
        version: experimentVersion, card: experimentProposal(experimentBase!, experimentEditor),
      })
      insight.value = null; experimentBase = null; modal.value = ''
      notify('已留下你确认的小实验，可以随时修改或结束')
    })
  }
  const feedbackText = ref('')
  const feedbackKind = ref('progress')
  const archives = ref<Issue[]>([])
  const usage = ref({used_cny: 0, limit_cny: 100, daily_calls: 0, daily_limit: 30, mode: 'demo'})
  const editor = reactive({
    title: '',
    options: '',
    constraints: '',
    confirmed: '',
    hypotheses: '',
    unknowns: '',
    next_step: ''
  })
  const editorVersion = ref(1)
  const planStepOnly = ref(false)
  let planStepBase: Card | null = null
  let editorContext: {
    issueId: string; token: string; session: ReturnType<typeof workspace.get>;
    suggestion: typeof suggestion.value; message?: ChatMessage;
  } | null = null

  function notify(message: string) {
    toast.value = message
    setTimeout(() => {
      toast.value = ''
    }, 2800)
  }

  function clearSession() {
    themePaint.clear()
    historyLoading.value = false; historyError.value = ''
    speech.reset()
    conversationAction.value = null
    for (const key of creatingDrafts.value) draftCreationCancelled.add(key)
    creatingDrafts.value = []
    workspace.reset(); conversations.value = []; openedIds.value = []; drawer.value = ''
    token.value = '';
    user.value = null;
    current.value = null;
    messages.value = [];
    suggestion.value = null
    draft.value = '';
    pendingText.value = '';
    archives.value = []
    Object.assign(form, newOnboarding())
    screen.value = 'auth';
    tab.value = 'now';
    modal.value = ''
    uni.removeStorageSync('agency.session')
  }

  const discovery = useDiscovery(user, request, notify, current)
  const discoveryDrafts = new Map<string, DraftSourceRef[]>()
  function removeSourceText(text: string, source: DraftSourceRef) {
    const next = text.includes(source.text) ? text.split(source.text).join('') : text.split(source.quote).join('〔原线索已不可用〕')
    return next.trim() ? next : ''
  }
  const validatingDiscovery = new Set<string>()
  watch(() => user.value?.id, () => discoveryDrafts.clear(), { flush: 'sync' })
  function withdrawDiscoveryDraft(key: string, source: DraftSourceRef) {
    const session = workspace.sessions[key]
    if (session) {
      session.draft.value = removeSourceText(session.draft.value, source)
      session.error.value = '原建议的依据已经变化，已撤下原线索。请检查输入后重新发送'
    }
    const remaining = (discoveryDrafts.get(key) || []).filter(item => item.id !== source.id)
    if (remaining.length) discoveryDrafts.set(key, remaining); else discoveryDrafts.delete(key)
    if (workspace.drafts[key]?.recommendation?.id === source.id) delete workspace.drafts[key].recommendation
    syncComposerDrafts()
  }
  async function invalidateDiscoverySources() {
    const account = user.value?.id
    for (const [key, sources] of discoveryDrafts) for (const source of [...sources]) {
      try {
        const valid = await discovery.verify({id:source.id,issueId:source.issue_id,strategy:source.strategy})
        if (user.value?.id !== account) return
        if (!valid) withdrawDiscoveryDraft(key, source)
      } catch { if (user.value?.id === account) withdrawDiscoveryDraft(key, source) }
    }
    await discovery.load()
  }
  async function openDiscoveryChat() {
    const issue = discovery.focus.value
    const target = discoveryDestination(conversations.value, issue?.id || null, activeConversation.value?.id)
    if (target) { await guarded(() => activateConversation(target)); return }
    current.value = issue; startNewChat()
  }
  const spaceForeground = ref(true)
  const bloomMoment = useBloomMoment(user, request, requestId)
  watch(() => [user.value?.id, tab.value, screen.value], () => {
    if (user.value && screen.value === 'space' && tab.value === 'discover') void bloomMoment.load()
  }, { flush: 'post' })
  onShow(() => { spaceForeground.value = true; if (user.value && screen.value === 'space' && tab.value === 'discover') void bloomMoment.load() })
  onHide(() => { spaceForeground.value = false })
  function chatAboutMoment() {
    const content = bloomMoment.moment.value?.content
    if (!content || !user.value) return
    // A separate draft; no old conversation, memory or card is silently changed.
    current.value = null
    startNewChat()
    workspace.active.value.draft.value = momentDraft(content)
  }


  async function request<T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, data?: unknown) {
    return api.request<T>(method, path, data).promise
  }

  async function guarded(action: () => Promise<unknown>, scope: OperationScope = 'data') {
    if (scope !== 'init' && busy.value) return false
    return operations.run(scope, async () => {
      try { await action() }
      catch (err) {
        if (scope === 'auth' && err instanceof ApiError && ['network', 'timeout'].includes(err.kind)) throw Error('暂时无法连接服务，你可以继续浏览，连接恢复后再保存')
        throw err
      }
    })
  }

  async function loadCurrent() {
    const next = await request<Issue | null>('GET', '/issues/current')
    current.value = next
    await refreshWorkspace()
    await restoreComposerDrafts()
    await onboardingProgress.load()
    void onboardingProgress.flush()
    if (current.value) {
      screen.value = 'space'
      // Restore account drafts before choosing the last visible composer.
      const savedId = user.value ? uni.getStorageSync(selectedConversationKey(user.value.id)) : ''
      const restoreId = isDraftKey(workspace.activeId.value) ? '' : workspace.activeId.value
      const selected = conversations.value.find(c => c.id === (restoreId || savedId)) || conversations.value.find(c => c.issue_id === current.value?.id && !c.archived_at)
      if (selected) await activateConversation(selected, false)
      const shell = Object.keys(workspace.drafts).filter(key => workspace.get(key).draft.value &&
        workspace.drafts[key].issueId === current.value?.id).slice(-1)[0]
      if (shell && !workspace.active.value.draft.value) { workspace.select(shell); if (!openedIds.value.includes(shell)) openedIds.value.push(shell) }
    } else {
      // A returning account may have only ended explorations. It still lands at home.
      archives.value = await request<Issue[]>('GET', '/issues')
      const paused = onboardingProgress.paused() || (!!user.value && !!uni.getStorageSync(pauseKeyFor(user.value.id)))
      screen.value = signedInScreen(false, archives.value.length > 0, paused)
      const shell = Object.keys(workspace.drafts).filter(key => workspace.get(key).draft.value).slice(-1)[0]
      if (shell) { workspace.select(shell); screen.value = 'space' }
    }
  }

  let initializing: Promise<void> | undefined
  async function checkConnection() {
    await guarded(async () => {
      config.value = await request('GET', '/config')
      operations.clear('auth')
    }, 'init')
    ready.value = true
    if (token.value && !offline.value) await guarded(async () => {
      user.value = await request<User>('GET', '/me')
      await loadCurrent()
    })
  }

  async function initialize() {
    if (initializing) return initializing
    initializing = checkConnection()
    try { await initializing } finally { initializing = undefined }
  }

  let journeyChanged = false
  const markJourneyChanged = () => { journeyChanged = true }
  onMounted(() => uni.$on('agency:journey-changed', markJourneyChanged))
  onUnmounted(() => uni.$off('agency:journey-changed', markJourneyChanged))
  onMounted(initialize)
  onShow(() => {
    // Timers can be suspended in the background. Re-read the wall clock and
    // rebuild the next boundary whenever the page returns to the foreground.
    themeClock.refresh()
    themeClock.start()
    if (ready.value && offline.value) void initialize()
    if (journeyChanged && user.value && ready.value && !offline.value) {
      journeyChanged = false
      void guarded(async () => {
        await refreshWorkspace()
        if (current.value) current.value = await request<Issue>('GET', `/issues/${current.value.id}`)
        if (tab.value === 'discover') await discovery.load()
        if (tab.value === 'plan') await plan.load()
      })
    }
  })
  onHide(() => {
    for (const key of creatingDrafts.value) draftCreationCancelled.add(key)
    workspace.cancelAll()
  })

  async function saveInitial() {
    const version = await onboardingProgress.prepareCompletion()
    try {
      current.value = await request<Issue>('POST', '/issues', { ...form, onboarding_progress_version: version })
      onboardingProgress.completed()
    } catch (error) { onboardingProgress.completionFailed(); throw error }
    if (user.value && form.support_style) user.value.support_style = form.support_style
    await refreshWorkspace()
    const first = conversations.value.find(c => c.issue_id === current.value?.id)
    if (first) await activateConversation(first, false)
    screen.value = 'space'
    tab.value = 'chat'
    if (user.value) {
      try {
        uni.removeStorageSync(draftKeyFor(user.value.id))
        uni.removeStorageSync(pauseKeyFor(user.value.id))
      } catch { /* The saved server record is authoritative. */ }
    }
    notify('这件事，已经为你留下了')
    void nextTick(() => uni.pageScrollTo({ scrollTop: 0, duration: 0 }))
  }

  async function saveQuestions(draftForm: Onboarding) {
    if (!user.value || screen.value !== 'onboard') return
    Object.assign(form, draftForm, { support_style: canonicalSupportStyle(draftForm.support_style || user.value.support_style) })
    await guarded(saveInitial, 'auth')
  }

  async function authenticate(mode: 'wechat' | 'demo-new' | 'demo-resume' = 'wechat') {
    const dev = mode !== 'wechat'
    if (mode === 'demo-new' && demoCredential.value &&
        !await confirm('创建新的演示账号？', '本机快捷登录将切换到新账号，之后无法从此入口找回旧账号的记录。确定创建吗？')) return
    if (user.value) {
      await guarded(loadCurrent, 'auth')
      return
    }
    await guarded(async () => {
      if (offline.value || !ready.value) {
        config.value = await request('GET', '/config')
        operations.clear('init'); ready.value = true
      }
      let path = '/auth/dev'
      const body: { privacy_accepted: true; code?: string; resume_token?: string } = {privacy_accepted: true}
      if (mode === 'demo-resume') {
        if (!demoCredential.value) throw Error('这台设备还没有可继续的演示账号，请先创建')
        body.resume_token = demoCredential.value.secret
      }
      if (!dev) {
        if (config.value.wechat_auth === false) throw Error('微信登录尚未配置，可以先继续浏览')
        path = '/auth/wechat'
        const login = await new Promise<UniApp.LoginRes>((resolve, reject) => uni.login({
          provider: 'weixin',
          success: resolve,
          fail: reject
        }))
        body.code = login.code
      }
      let result: { token: string; user: User; resume_token?: string }
      try { result = await request('POST', path, body) }
      catch (err) {
        if (mode === 'demo-resume' && err instanceof ApiError && err.status === 401) {
          forgetDemo()
          throw Error('本机演示登录已过期或账号已删除，请创建新的演示账号')
        }
        throw err
      }
      if (result.resume_token) rememberDemo(result.user.id, result.resume_token)
      token.value = result.token;
      user.value = result.user;
      uni.setStorageSync('agency.session', result.token)
      await loadCurrent()
      if (screen.value === 'space') notify('欢迎回来，按自己的节奏继续')

    }, 'auth')
  }

  async function selectTab(nextTab: typeof tab.value) {
    if (nextTab !== tab.value) { navigationRevision++; chatHandoff.cancel() }
    if (nextTab === 'chat' && screen.value === 'onboard') pauseOnboarding()
    if (nextTab === 'chat' && !current.value && !isDrafting.value) { startNewChat(); return }
    if (tab.value === nextTab) return
    error.value = '';
    if (nextTab !== 'chat') modePickerOpen.value = false
    tab.value = nextTab
    await nextTick()
    uni.pageScrollTo({scrollTop: nextTab === 'discover' ? discovery.scrollTop.value : 0, duration: 0})
    if (nextTab === 'discover') void discovery.load()
    if (nextTab === 'settings') await guarded(async () => {
      usage.value = await request('GET', '/usage')
    })
    if (nextTab === 'chat' && !activeConversation.value && !isDrafting.value && current.value && !current.value.ended_at) startNewChat()
  }

  function openEditor(proposal = false) {
    if (!current.value) return
    planStepOnly.value = false
    planStepBase = null
    const session = workspace.active.value
    const reviewed = proposal ? session.suggestion.value : null
    const message = session.messages.value[session.messages.value.length - 1]
    editorContext = { issueId: current.value.id, token: token.value, session, suggestion: reviewed,
      message: reviewed && message?.role === 'assistant' && message.payload?.suggestion === reviewed ? message : undefined }
    const source = proposal && suggestion.value ? mergeSuggestion(current.value.card, suggestion.value) : current.value.card
    editor.title = source.title;
    editor.next_step = source.next_step
    for (const field of editFields) editor[field.key] = source[field.key].join('\n')
    editorVersion.value = current.value.version
    error.value = '';
    modal.value = 'edit'
  }

  async function saveEditor() {
    const context = editorContext
    if (!current.value || !context) return
    await guarded(async () => {
      const updated = {title: editor.title.trim(), next_step: editor.next_step.trim()} as Card
      for (const field of editFields) updated[field.key] = editor[field.key].split('\n').map(v => v.trim()).filter(Boolean)
      const saved = await request<Issue>('PUT', `/issues/${context.issueId}/card`, {
        version: editorVersion.value,
        card: planStepOnly.value && planStepBase ? { ...planStepBase, next_step: updated.next_step } : updated,
        ...(context.message?.id ? { suggestion_message_id: context.message.id } : {})
      })
      if (token.value !== context.token) return
      if (current.value?.id === context.issueId) current.value = saved
      if (context.suggestion) {
        if (context.message?.payload) { context.message.payload.suggestion = null; context.message.payload.plan_saved = true }
        if (context.session.suggestion.value === context.suggestion) context.session.suggestion.value = null
      }
      if (editorContext === context && workspace.active.value === context.session) modal.value = ''
      notify('已保存你确认的内容')
    })
  }

  async function reloadVersion() {
    if (!current.value || !editorContext) return
    const context = editorContext
    await guarded(async () => {
      const latest = await request<Issue>('GET', `/issues/${context.issueId}`)
      if (token.value !== context.token || editorContext !== context) return
      if (current.value?.id === latest.id) current.value = latest
      editorVersion.value = latest.version
      if (planStepOnly.value) planStepBase = JSON.parse(JSON.stringify(latest.card))
      notify('已读取最新版本，你的编辑内容仍保留，请核对后再保存')
    })
  }

  function openPlanStep() {
    if (!current.value || current.value.ended_at || busy.value) return
    openEditor()
    planStepOnly.value = true
    planStepBase = JSON.parse(JSON.stringify(current.value.card))
  }

  async function prepareConversationDraft(text: string, issue: Issue | null, origin: string, separate = false, targetOverride?: Conversation | null) {
    if (openingHandoff || !user.value || issue?.ended_at || busy.value) return null
    if (text.length > CHAT_INPUT_LIMIT) { notify('带入的文字过长，原内容仍保留，请先缩短再继续'); return null }
    openingHandoff = true
    const account = token.value, owner = user.value.id, revision = navigationRevision
    const valid = () => token.value === account && user.value?.id === owner && navigationRevision === revision
    const originalIssue = current.value, originalId = workspace.activeId.value
    try {
      const target = separate ? null : targetOverride === undefined ? homeConversationFor(issue, conversations.value, activeConversation.value?.id) : targetOverride
      const shell = !separate && isDrafting.value && workspace.drafts[workspace.activeId.value]?.issueId === (issue?.id ?? null) ? workspace.active.value : null
      const session = shell || (target ? workspace.get(target.id) : null)
      let choice: 'new' | 'append' | 'cancel' = !session || session.sending.value ? 'new' : 'append'
      let previewed = session?.draft.value || ''
      if (session && choice !== 'new' && session.draft.value.trim() && session.draft.value.trim() !== text.trim()) {
        choice = await chatHandoff.choose({current:session.draft.value,incoming:text,title:issue?.title || '当前问题',origin})
      }
      if (!valid() || choice === 'cancel') return null
      if (target && session && !shell && choice !== 'new') {
        if (!await activateConversation(target, false, valid) || !valid() || workspace.activeId.value !== target.id) return null
        if (session.draft.value !== previewed && session.draft.value.trim() && session.draft.value.trim() !== text.trim()) {
          previewed = session.draft.value
          choice = await chatHandoff.choose({current:previewed,incoming:text,title:issue?.title || '当前问题',origin})
          if (!valid() || choice === 'cancel') {
            if (valid() && choice === 'cancel') {
              current.value = originalIssue; workspace.select(originalId)
              try { uni.setStorageSync(selectedConversationKey(owner), originalId) } catch { /* Selection can stay in memory. */ }
            }
            return null
          }
        }
      }
      if (choice === 'new') { current.value = issue; startNewChat() }
      const destination = workspace.active.value
      destination.draft.value = combineDrafts(choice === 'new' ? '' : destination.draft.value, text)
      drawer.value = ''; tab.value = 'chat'
      return destination
    } finally { openingHandoff = false }
  }
  async function preparePlanChat(text: string) {
    if (!current.value) return null
    return prepareConversationDraft(text, current.value, 'Plan')
  }
  async function openPlanChat(concern = '', record = false) {
    if (tab.value !== 'plan') return
    const account = token.value, issueId = current.value?.id, revision = navigationRevision
    const text = concern.trim() || (record ? plan.state.value?.latest?.text || '' : '')
    try {
      await preparePlanChat(`${text ? '我想从这件事聊起：' + text + '\n\n' : ''}${record ? '我想和你说说后来发生的事，请先听我讲，帮我理清经历和感受。等我说整理时，帮我写成可编辑的记录草稿；不把未决定的想法写成结论，也不自动改变下一步。' : '我想围绕当前探索，一起想一个适合现在的小尝试。请先了解具体难处、希望改变什么以及现实条件。信息足够时整理成可编辑的计划草稿，把行动与经历分开；不要把追问当成下一步。'}`)
    } catch (err) { if (token.value === account && current.value?.id === issueId && navigationRevision === revision) plan.error.value = err instanceof Error ? err.message : '暂时无法打开对话，输入仍保留' }
  }
  const plan = usePlan({ current, userKey: computed(() => user.value?.id || ''), retained: computed(() => !!user.value?.save_chat), request,
    chat: preparePlanChat, id: requestId, changed: (sourceId, draft) => {
      for (const session of Object.values(workspace.sessions)) for (const message of session.messages.value) {
        if (message.payload && ((sourceId && message.id === sourceId) || (draft && message.payload.plan_draft && toRaw(message.payload.plan_draft) === toRaw(draft)))) {
          message.payload.plan_draft = null
          message.payload.plan_saved = true
        }
      }
      notify('已保存你确认的内容'); void refreshWorkspace()
    } })
  watch([tab, () => current.value?.id], () => { if (tab.value === 'plan' && current.value) void plan.load() })
  const planDraft = computed(() => {
    const last = messages.value[messages.value.length - 1]
    return last?.role === 'assistant' ? last.payload?.plan_draft || null : null
  })
  const canSummarizePlan = computed(() => {
    if (planDraft.value || messages.value[messages.value.length - 1]?.role !== 'assistant') return false
    for (let i = messages.value.length - 1; i >= 0; i--) {
      const message = messages.value[i]
      if (message.payload?.plan_saved) return false
      if (message.role === 'user') return true
    }
    return false
  })
  function reviewPlanDraft() {
    const last = messages.value[messages.value.length - 1]
    if (planDraft.value) plan.review(planDraft.value, user.value?.save_chat ? last?.id : undefined, workspace.active.value)
  }
  function summarizeForPlan() {
    const session = workspace.active.value
    if (session.sending.value || readOnlyConversation.value || !current.value || !canSummarizePlan.value) return
    const text = '请把我们刚才聊到的真实经历、感受和仍未决定的部分整理成一份可编辑的记录草稿。不要复制整段回复，不把追问写成下一步。只在已讨论出具体行动时单独列出下一步，否则先不写下一步。我会修改并确认后再保存。'
    if (session.draft.value.trim()) { notify('输入框里还有未发送内容，请先处理；原文已保留'); return }
    session.draft.value = text
  }

  function openPlanPause() {
    if (!current.value || current.value.ended_at || busy.value) return
    if (!feedbackText.value.trim()) {
      feedbackText.value = '我想先放一放这一步，之后再决定是否继续'
      feedbackKind.value = 'change'
    }
    error.value = ''
    modal.value = 'feedback'
  }

  async function saveFeedback() {
    if (!feedbackText.value.trim() || !current.value) return
    await guarded(async () => {
      current.value = await request('POST', `/issues/${current.value!.id}/feedback`, {
        kind: feedbackKind.value,
        text: feedbackText.value
      })
      feedbackText.value = '';
      modal.value = '';
      notify('这次记录，已经留下')
    })
  }

  function requestId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.floor(Math.random() * 16)
      return (c === 'x' ? r : (r & 3) | 8).toString(16)
    })
  }

  async function sendChat() {
    const key = workspace.activeId.value, session = workspace.active.value
    if (validatingDiscovery.has(key)) return
    if (sending.value || creatingConversation.value || !session.draft.value.trim() || readOnlyConversation.value || !user.value) return
    if (!activeConversation.value && !isDrafting.value) return
    if (!user.value.ai_consent) { modal.value = 'ai'; return }
    const account = user.value.id, sessionToken = token.value
    const discoverySources = discoveryDrafts.get(key) || []
    if (discoverySources.length) {
      validatingDiscovery.add(key)
      try {
        for (const discoverySource of discoverySources) {
        const valid = await discovery.verify({id:discoverySource.id,issueId:discoverySource.issue_id,strategy:discoverySource.strategy})
        if (user.value?.id !== account || token.value !== sessionToken || workspace.activeId.value !== key) return
        if (!valid) {
          withdrawDiscoveryDraft(key, discoverySource)
          return
        }
        }
      } catch {
        session.error.value = '暂时无法确认建议的依据，输入已保留，请稍后重试'
        return
      } finally { validatingDiscovery.delete(key) }
    }
    const context = workspace.drafts[key]
    operations.clear('ai')
    let conversationId = activeConversation.value?.id
    if (!conversationId) {
      if (!context) return
      creatingDrafts.value.push(key)
      draftCreationCancelled.delete(key)
      try {
        const result = await request<{ conversation: Conversation; issue: Issue }>('POST', '/discovery/conversations', {
          request_id: context.requestId, issue_id: context.issueId,
          title: session.draft.value.trim().slice(0, 30),
          support_style: canonicalSupportStyle(selectedMode.value),
        })
        if (user.value?.id !== account || token.value !== sessionToken || workspace.sessions[key] !== session) return
        conversationId = result.conversation.id
        changedConversation(result.conversation)
        workspace.promote(key, conversationId)
        void draftSync.transfer(key, conversationId, session.draft.value, result.issue.id)
        if (discoverySources.length) { discoveryDrafts.delete(key); discoveryDrafts.set(conversationId, discoverySources) }
        syncComposerDrafts()
        openedIds.value = openedIds.value.map(id => id === key ? conversationId! : id)
        if (workspace.activeId.value === conversationId) {
          current.value = result.issue
          try { uni.setStorageSync(selectedConversationKey(account), conversationId) } catch { /* Presentation state only. */ }
        }
        if (draftCreationCancelled.has(key)) return
      } catch (err) {
        if (user.value?.id === account && token.value === sessionToken) session.error.value = err instanceof Error ? err.message : '会话暂时没有保存，输入仍保留'
        return
      } finally {
        creatingDrafts.value = creatingDrafts.value.filter(id => id !== key)
        draftCreationCancelled.delete(key)
      }
    }
    const before = session.messages.value.length
    await session.send(conversationId)
    if (user.value?.id !== account || token.value !== sessionToken) return
    if (session.messages.value.length > before && session.messages.value[session.messages.value.length-1]?.role === 'assistant') {
      welcomeCompleted.value = true
      try { uni.setStorageSync('agency.welcome-completed.v1:'+account, true) } catch { /* The welcome can remain local to this visit. */ }
    }
    if (session.messages.value.length > before) discoveryDrafts.delete(conversationId)
    if (context?.recommendation && session.messages.value.length > before) {
      discovery.explored(context.recommendation); delete workspace.drafts[conversationId]
    }
    await guarded(refreshWorkspace)
  }

  function cancelChat() {
    if (creatingDrafts.value.includes(workspace.activeId.value)) draftCreationCancelled.add(workspace.activeId.value)
    workspace.active.value.cancel()
  }

  function editMessage(index: number) {
    if (busy.value || sending.value || readOnlyConversation.value) return
    workspace.active.value.beginEdit(index)
  }
  async function saveMessageEdit() {
    const id = workspace.activeId.value, session = workspace.active.value
    if (!id || sending.value || readOnlyConversation.value) return
    if (!user.value?.ai_consent) { notify('请先在“我的”中同意 AI 数据处理说明'); return }
    operations.clear('ai')
    await session.send(id, 'chat', true)
    if (user.value) await guarded(refreshWorkspace)
  }

  async function consentAI() {
    await guarded(async () => {
      user.value = await request('PUT', '/me', {ai_consent: true});
      modal.value = ''
    })
    if (user.value?.ai_consent && draft.value.trim()) await sendChat()
  }

  function confirm(title: string, content: string) {
    return new Promise<boolean>(resolve => uni.showModal({
      title,
      content,
      confirmText: '确认',
      cancelText: '再想想',
      confirmColor: '#253148',
      success: result => resolve(result.confirm),
      fail: () => resolve(false)
    }))
  }

  async function toggleSaveChat() {
    if (!user.value) return
    const save = !user.value.save_chat
    if (!save && !await confirm('关闭聊天保存', '已保存的聊天、未发送草稿和会话总结也会被清除；你确认的长期记忆、决策卡和反馈会保留，可分别管理')) return
    await guarded(async () => {
      user.value = await request('PUT', '/me', {save_chat: save});
      if (save) await restoreComposerDrafts()
      workspace.cancelAll()
      if (!save) for (const session of Object.values(workspace.sessions)) {
        session.messages.value = []; session.summary.value = null; session.summaryDraft.value = null;
        session.suggestion.value = null; session.insight.value = null; session.olderCursor.value = null
        session.closeEdit()
      }
      await refreshWorkspace()
      notify(save ? '之后的聊天会保存到你的账号' : '已关闭，并清除已保存的聊天记录')
    })
  }

  async function setTheme(theme: ThemeId) {
    if (!user.value || screen.value !== 'space' || applyingTheme.value || themeAutoBusy.value) return
    themeClock.refresh()
    const accountId = user.value.id
    const slotKey = themeSlot.value.key
    const autoAtChoice = themeAuto.value
    const previousTheme = user.value.theme
    const previousOverride = themePreference.overrideFor(accountId, slotKey)
    error.value = ''
    applyingTheme.value = theme
    // Apply the choice immediately. An unrelated data request must not make the
    // appearance controls feel unresponsive; a failed save rolls the choice back.
    user.value = {...user.value, theme}
    if (autoAtChoice) themePreference.setOverride(accountId, theme, slotKey)
    else themePreference.clearOverride(accountId)
    activeThemeId.value = theme
    try {
      await request<User>('PUT', '/me', {theme})
    } catch (err) {
      if (user.value?.id === accountId) {
        user.value = {...user.value, theme: previousTheme}
        if (autoAtChoice) {
          if (previousOverride && themeSlot.value.key === slotKey) {
            themePreference.setOverride(accountId, previousOverride, slotKey)
          } else themePreference.clearOverride(accountId)
        } else themePreference.clearOverride(accountId)
        applyDesiredTheme(true)
      }
      if (user.value?.id === accountId) error.value = err instanceof Error ? err.message : '主题暂时没有保存，请稍后重试'
    } finally { applyingTheme.value = null }
  }

  async function toggleThemeAuto() {
    const current = user.value
    if (!current || screen.value !== 'space' || themeAutoBusy.value || applyingTheme.value) return
    themeClock.refresh()
    const accountId = current.id
    const slotKey = themeSlot.value.key
    error.value = ''
    if (themeAuto.value) {
      // Turning auto off pins the palette currently on screen, so the switch
      // itself never causes a visual jump.
      const pinned = activeTheme.value.id
      const previousTheme = current.theme
      const previousOverride = themePreference.overrideFor(accountId, slotKey)
      themeAutoBusy.value = true
      themePreference.setAuto(accountId, false)
      user.value = {...current, theme: pinned}
      activeThemeId.value = pinned
      try {
        await request<User>('PUT', '/me', {theme: pinned})
        if (user.value?.id === accountId) notify('已关闭自动切换，当前主题会长期保留')
      } catch (err) {
        if (user.value?.id === accountId) {
          themePreference.setAuto(accountId, true)
          if (previousOverride && themeSlot.value.key === slotKey) {
            themePreference.setOverride(accountId, previousOverride, slotKey)
          }
          user.value = {...user.value, theme: previousTheme}
          applyDesiredTheme(true)
        }
        if (user.value?.id === accountId) error.value = err instanceof Error ? err.message : '自动切换设置暂时没有保存，请稍后重试'
      } finally { themeAutoBusy.value = false }
      return
    }
    themePreference.setAuto(accountId, true)
    applyDesiredTheme(true)
    notify('已开启，主题会随时间自动切换')
  }

  async function setSupportStyle(support_style: string) {
    await guarded(async () => {
      user.value = await request('PUT', '/me', {support_style});
      modal.value = '';
      notify('已保存新会话的默认回应方式')
    })
  }

  async function setChatMode(mode: SupportMode) {
    if (busy.value || sending.value || !activeConversation.value) return
    modePickerOpen.value = false
    if (mode === selectedMode.value) return
    await guarded(async () => {
      changedConversation(await request<Conversation>('PUT', `/conversations/${activeConversation.value!.id}`, { version: activeConversation.value!.version, support_style: mode }))
      starterHint.value = ''
    }, 'data')
  }

  async function useChatStarter(prompt: string) {
    if (sending.value || busy.value) return
    const account = token.value
    try {
      const session = await prepareConversationDraft(prompt, current.value, '聊天建议', false, activeConversation.value)
      if (session) starterHint.value = '已放入输入框，可以修改后再发送'
    } catch (err) { if (account === token.value) error.value = err instanceof Error ? err.message : '暂时无法带入，原输入仍保留' }
  }

  function updateDraft(value: string) {
    const sources = (discoveryDrafts.get(workspace.activeId.value) || []).filter(source => value.includes(source.quote))
    if (sources.length) discoveryDrafts.set(workspace.activeId.value, sources); else discoveryDrafts.delete(workspace.activeId.value)
    draft.value = value
    starterHint.value = ''
  }

  function toggleWebSearch() {
    workspace.active.value.webSearchOn.value = !workspace.active.value.webSearchOn.value
  }

  async function toggleAIConsent() {
    if (!user.value?.ai_consent) {
      modal.value = 'ai';
      return
    }
    workspace.cancelAll()
    await guarded(async () => {
      user.value = await request('PUT', '/me', {ai_consent: false})
      for (const session of Object.values(workspace.sessions)) { session.suggestion.value = null; session.insight.value = null; session.summaryDraft.value = null }
      notify('已关闭 AI 对话；卡片和反馈仍可使用')
    })
  }

  async function endIssue() {
    if (!current.value || !await confirm('结束这件事', '已经确认的卡片与进展会留在历史里，之后可以开始一个新问题')) return
    await guarded(async () => {
      await request('POST', `/issues/${current.value!.id}/end`)
      for (const c of conversations.value.filter(c => c.issue_id === current.value?.id)) workspace.get(c.id).cancel()
      await loadCurrent()
      tab.value = 'now'
    })
  }

  async function showHistory() {
    drawer.value = 'list'
    if (historyLoading.value) return
    const session = token.value
    historyLoading.value = true; historyError.value = ''
    try { await refreshWorkspace() }
    catch (err) { if (token.value === session) historyError.value = err instanceof Error ? err.message : '会话列表未能更新，请重试' }
    finally { if (token.value === session) historyLoading.value = false }
  }

  async function refreshWorkspace() {
    const session = token.value
    async function all<T extends { id: string }>(path: string): Promise<T[]> {
      const items = new Map<string, T>()
      for (let offset = 0; ; offset += 100) {
        const page = await request<T[]>('GET', `${path}${path.includes('?') ? '&' : '?'}limit=100&offset=${offset}`)
        for (const item of page) items.set(item.id, item)
        if (page.length < 100) return [...items.values()]
      }
    }
    const [issues, live, archived] = await Promise.all([
      all<Issue>('/issues'), all<Conversation>('/conversations'), all<Conversation>('/conversations?archived=true'),
    ])
    if (token.value !== session) return
    archives.value = issues; conversations.value = [...live, ...archived]
  }
  function changedConversation(item: Conversation) {
    const index = conversations.value.findIndex(c => c.id === item.id)
    if (index < 0) conversations.value.unshift(item); else conversations.value[index] = item
    if (item.archived_at) workspace.get(item.id).cancel()
  }
  async function deletedConversation(id: string) {
    draftSync.forget(id)
    const wasActive = workspace.activeId.value === id
    workspace.remove(id)
    openedIds.value = openedIds.value.filter(key => key !== id)
    conversations.value = conversations.value.filter(item => item.id !== id)
    if (wasActive) {
      if (user.value) { try { uni.removeStorageSync(selectedConversationKey(user.value.id)) } catch { /* Missing IDs are ignored on restore. */ } }
      const next = conversations.value.find(item => !item.archived_at && item.issue_id === current.value?.id)
      if (next) await guarded(() => activateConversation(next, false))
      else if (current.value && !current.value.ended_at) startNewChat()
    }
  }
  let activationRun = 0
  async function activateConversation(item: Conversation, navigate = true, stillWanted: () => boolean = () => true) {
    const run = ++activationRun, account = token.value, owner = user.value?.id
    const isCurrent = () => run === activationRun && token.value === account && user.value?.id === owner && stillWanted()
    const session = workspace.get(item.id)
    const issue = await request<Issue>('GET', `/issues/${item.issue_id}`)
    if (!isCurrent()) return false
    if (!session.loaded.value) {
      const page = await request<{ items: ChatMessage[]; next_cursor: string | null }>('GET', `/conversations/${item.id}/messages`)
      if (!isCurrent()) return false
      session.messages.value = page.items; session.olderCursor.value = page.next_cursor; session.summary.value = item.summary
      const last = page.items[page.items.length - 1]
      session.suggestion.value = last?.payload?.suggestion || null; session.insight.value = last?.payload?.insight || null
      session.loaded.value = true
    }
    current.value = issue; workspace.select(item.id)
    if (user.value) { try { uni.setStorageSync(selectedConversationKey(user.value.id), item.id) } catch { /* A presentation preference may stay in memory. */ } }
    if (!openedIds.value.includes(item.id)) openedIds.value.push(item.id)
    modePickerOpen.value = false; starterHint.value = ''; chatMenuOpen.value = false; operations.clear('ai')
    if (navigate) { drawer.value = ''; tab.value = 'chat'; await nextTick(); uni.pageScrollTo({ scrollTop: 0, duration: 0 }) }
    return true
  }
  async function selectConversation(item: Conversation) { navigationRevision++; chatHandoff.cancel(); await guarded(async () => { await activateConversation(item) }) }
  async function selectExploration(issue: Issue) {
    navigationRevision++; chatHandoff.cancel()
    await guarded(async () => {
      current.value = await request('GET', `/issues/${issue.id}`)
      const first = conversations.value.find(c => c.issue_id === issue.id && !c.archived_at) || conversations.value.find(c => c.issue_id === issue.id)
      if (first) await activateConversation(first, false)
      else workspace.activeId.value = ''
      tab.value = 'now'; drawer.value = ''
    })
  }
  async function resumeExploration() { if (!current.value) return; await guarded(async () => { current.value = await request('POST', `/issues/${current.value!.id}/resume`); await refreshWorkspace(); notify('探索已恢复') }) }
  function beginAnotherExploration() {
    if (!newExplorationRequest) newExplorationRequest = requestId()
    navigationRevision++; chatHandoff.cancel(); drawer.value = ''; error.value = ''; newExplorationOpen.value = true
  }
  function newExplorationQuestions() {
    newExplorationOpen.value = false; Object.assign(form, newOnboarding()); beginOnboarding()
  }
  async function saveNewExploration() {
    if (!user.value || !newExplorationDraft.title.trim()) return
    if (newExplorationDraft.title.trim().length > 120 || newExplorationDraft.background.trim().length > 400) {
      error.value = '标题最多 120 字，背景最多 400 字，原文仍保留，请修改后保存'; return
    }
    const account = token.value, owner = user.value.id, revision = navigationRevision
    const body = {title:newExplorationDraft.title.trim(), background:newExplorationDraft.background.trim(), support_style:canonicalSupportStyle(user.value.support_style)}
    const payload = JSON.stringify(body)
    if (newExplorationPayload !== payload || !newExplorationRequest) { newExplorationRequest = requestId(); newExplorationPayload = payload }
    await guarded(async () => {
      const created = await request<Issue>('POST', '/issues', {
        creation_request_id:newExplorationRequest,
        ...body,
      })
      if (account !== token.value || user.value?.id !== owner || revision !== navigationRevision) return
      await refreshWorkspace()
      if (account !== token.value || user.value?.id !== owner || revision !== navigationRevision) return
      const conversation = conversations.value.find(item => item.issue_id === created.id && !item.archived_at)
      if (conversation) await activateConversation(conversation, true, () => account === token.value && revision === navigationRevision)
      else { current.value = created; startNewChat() }
      newExplorationOpen.value = false; newExplorationDraft.title = ''; newExplorationDraft.background = ''
      newExplorationRequest = ''; newExplorationPayload = ''
      notify('已单独建立，这件事有自己的卡片和计划')
    })
  }
  async function loadOlderMessages() {
    const id = workspace.activeId.value, session = workspace.get(id)
    if (!session.olderCursor.value) return
    await guarded(async () => { const page = await request<{ items: ChatMessage[]; next_cursor: string | null }>('GET', `/conversations/${id}/messages?before=${session.olderCursor.value}`); session.messages.value.unshift(...page.items); session.olderCursor.value = page.next_cursor })
  }
  async function generateSummary() {
    if (!activeConversation.value || readOnlyConversation.value) return
    if (!user.value?.ai_consent) { notify('请先在「我的」中允许 AI 数据处理'); return }
    const id = activeConversation.value.id
    await workspace.get(id).send(id, 'summary')
  }
  function reviewSummary(summary: ConversationSummary | null) {
    workspace.active.value.summary.value = summary; workspace.active.value.summaryDraft.value = null; workspace.active.value.cancel()
  }
  async function recoverReply() {
    const id = workspace.activeId.value, session = workspace.get(id)
    const requestId = session.errorRequestId.value || session.lastRequestId.value
    if (!requestId) return
    await guarded(async () => {
      const status = await request<{ status: string; recoverable: boolean }>('GET', `/requests/${requestId}`)
      if (status.status === 'pending') { notify('请求仍在处理中，请稍后再查看'); return }
      if (status.recoverable) {
        const page = await request<{ items: ChatMessage[]; next_cursor: string | null }>('GET', `/conversations/${id}/messages`)
        const conversation = await request<Conversation>('GET', `/conversations/${id}`)
        if (session.sending.value || session.errorRequestId.value !== requestId) return
        const last = page.items[page.items.length - 1]
        session.messages.value = page.items; session.olderCursor.value = page.next_cursor; session.error.value = ''; session.errorRequestId.value = ''
        if (workspace.activeId.value === id) operations.clear('ai')
        session.suggestion.value = last?.payload?.suggestion || null
        session.insight.value = last?.payload?.insight || null; session.insightReaction.value = ''
        session.phaseChange.value = null; session.phaseConfirmed.value = false; session.phaseOpen.value = false
        session.closeEdit()
        session.summary.value = conversation.summary; session.summaryDraft.value = null
        notify('已读取保存的回复，输入草稿仍保留')
      } else notify('没有可恢复的已保存回复；不会自动再次调用模型')
    })
  }

  async function logOut(restartDemo = false) {
    if (restartDemo && !config.value.dev_auth) return
    const approved = restartDemo || await confirm('退出登录', '退出后本机的草稿和开场进度会保留，登录后可以继续')
    if (!approved) return
    await guarded(async () => {
      if (config.value.dev_auth && user.value && demoCredential.value?.userId !== user.value.id) {
        try {
          const result = await request<{ resume_token: string }>('POST', '/auth/dev/remember', { privacy_accepted: true })
          rememberDemo(user.value.id, result.resume_token)
        } catch { /* Existing WeChat accounts use their own sign-in path. */ }
      }
      syncComposerDrafts(); await draftSync.flush(); await onboardingProgress.flush()
      await request('POST', '/auth/logout');
      clearSession()
      if (restartDemo) screen.value = 'auth'
    })
  }

  async function deleteAccount() {
    if (!await confirm('删除我的全部记录', '账号、卡片、反馈和已保存的聊天将被永久删除，无法撤销')) return
    await guarded(async () => {
      const id = user.value?.id;
      await request('DELETE', '/me');
      onboardingProgress.forget()
      if (demoCredential.value?.userId === id) forgetDemo()
      if (id) {
        try { uni.removeStorageSync(draftKeyFor(id)); uni.removeStorageSync(pauseKeyFor(id)); uni.removeStorageSync(selectedConversationKey(id)); uni.removeStorageSync(discoveryStateKey(id)) }
        catch { /* A local storage failure must not keep a deleted account signed in. */ }
      }
      if (id) await localAvatars.clear(id);
      clearSession();
      notify('你的个人记录已删除')
    })
  }

  let openingDiscovery = false
  async function explorePrompt(item: DiscoveryAngle, separate = false) {
    if (openingDiscovery || tab.value !== 'discover' || !user.value || discovery.loading.value) return
    if (!discovery.recommendations.value.some(value => value.id === item.id)) return
    openingDiscovery = true
    const account = user.value.id
    try {
      await discovery.load()
      if (user.value?.id !== account || tab.value !== 'discover') return
      const fresh = discovery.recommendations.value.find(r => r.id === item.id)
      if (!fresh || discovery.error.value) { notify('这条建议的依据已变化或暂时无法确认，请重新查看'); return }
      const issue = discovery.issues.value.find(i => i.id === fresh.issueId) || null
      let destination = separate ? null : discoveryDestination(conversations.value, fresh.issueId, activeConversation.value?.id)
      if (destination) {
        const latest = await request<Conversation>('GET', '/conversations/' + destination.id)
        if (latest.archived_at || latest.issue_id !== fresh.issueId) { notify('原对话已不可用，请选择另开一段聊聊'); return }
        destination = latest
      }
      if (user.value?.id !== account || tab.value !== 'discover') return
      const session = await prepareConversationDraft(discoveryDraft(fresh), issue, '发现', separate, destination)
      if (!session || user.value?.id !== account) return
      const key = workspace.activeId.value, context = workspace.drafts[key]
      if (context) context.recommendation = fresh
      if (fresh.issueId) discoveryDrafts.set(key, [...(discoveryDrafts.get(key) || []).filter(source => source.id !== fresh.id),
        {id:fresh.id,issue_id:fresh.issueId,strategy:fresh.strategy,quote:discoveryQuotedEvidence(fresh),text:discoveryDraft(fresh)}])
      syncComposerDrafts()
    } catch (err) { if (user.value?.id === account) notify(err instanceof Error ? err.message : '暂时无法打开这段探索') }
    finally { openingDiscovery = false }
  }

  return {
    chatHandoff,
    newExplorationOpen, newExplorationDraft, saveNewExploration, newExplorationQuestions,
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
    onboardingProgress,
    restoreRemoteOnboarding,
    onboardingResume: onboardingProgress.restored,
    onboardingSyncMessage: onboardingProgress.message,
    onboardingSyncMode: onboardingProgress.mode,
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
    historyLoading,
    historyError,
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
    firstWelcome, welcomeHasContext,
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
    openPlanStep,
    openPlanChat,
    plan,
    planDraft,
    canSummarizePlan,
    reviewPlanDraft,
    summarizeForPlan,
    openPlanPause,
    planStepOnly,
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
    openDiscoveryChat,
    invalidateDiscoverySources,
    discovery,
    bloomMoment,
    spaceForeground,
    chatAboutMoment,
    newChatStarters,
    todayLabel,
    greeting,
    canonicalSupportStyle,
  }
}

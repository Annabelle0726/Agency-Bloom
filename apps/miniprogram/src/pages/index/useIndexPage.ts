import {computed, nextTick, onMounted, onUnmounted, reactive, ref, watch} from 'vue'
import {onHide, onReady, onShow} from '@dcloudio/uni-app'
import {makePreview, mergeSuggestion, experimentProposal} from '../../domain'
import {newOnboarding, canonicalSupportStyle} from '../../onboarding'
import type {SupportMode} from '../../onboarding'
import {chatEntryFor, draftChangeFor} from '../../chat-entry'
import { OPENING_KEY, initialScreen, signedInScreen, draftKeyFor, pauseKeyFor } from '../../entry'
import type { EntryScreen } from '../../entry'
import {navigationItems, themeForSession, themeStyle, themeNavSvg} from '../../themes'
import type {ThemeId, SpaceTab} from '../../themes'
import type {Card, ChatMessage, Issue, Onboarding, User, Experiment, Conversation, ConversationSummary} from '../../domain'
import {ApiError, createApi} from '../../http'
import {createOperationState} from '../../operations'
import type {OperationScope} from '../../operations'
import {createChatWorkspace} from '../../chat-workspace'
import {useBloomMoment, momentDraft} from '../../bloom-moment'
import {useDiscovery} from '../../use-discovery'
import {discoveryStateKey} from '../../discovery'
import type {DiscoveryRecommendation} from '../../discovery'
import type {ConversationAction, ConversationMenuAction} from '../../conversation-action'
import {createAvatarStore} from '../../avatar'
import {createManualThemePreference, personalSpaceTheme} from '../../theme-preference'
import {newChatStarters, experimentFields, editFields, todayLabel, greeting} from './data'


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
    try { uni.removeStorageSync(pauseKeyFor(user.value.id)) } catch { /* Continue in memory. */ }
    operations.clear('auth')
    screen.value = 'onboard'
  }
  function pauseOnboarding() {
    if (busy.value || !user.value) return
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
  const operations = createOperationState()
  const busy = computed(() => operations.busy.auth || operations.busy.data)
  const error = computed({ get: () => operations.errors.data, set: value => { operations.errors.data = value } })
  const authError = computed(() => operations.errors.auth)
  const chatError = computed(() => workspace.active.value.error.value || operations.errors.ai)
  const offline = computed(() => !!operations.errors.init)
  const toast = ref('')
  const form = reactive<Onboarding>(newOnboarding())
  const preview = computed(() => makePreview(form))
  const manualThemePreference = createManualThemePreference({
    read: key => uni.getStorageSync(key),
    write: (key, value) => uni.setStorageSync(key, value),
  })
  function manualThemeChosen(): boolean {
    const id = user.value?.id
    return !id || manualThemePreference.isChosen(id)
  }
  const activeTheme = computed(() => {
    if (screen.value !== 'space') return themeForSession(user.value, false)
    return personalSpaceTheme(user.value, manualThemeChosen(), new Date().getHours())
  })
  const activeThemeStyle = computed(() => themeStyle(activeTheme.value))
  const dark = computed(() => activeTheme.value.dark)
  const applyingTheme = ref<ThemeId | null>(null)
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
  }

  onReady(syncStatusBar)
  watch(activeTheme, syncStatusBar)
  // #endif
  const card = computed(() => current.value?.card ?? preview.value)
  const workspace = createChatWorkspace({
    post: (conversationId, body) => api.request('POST', `/conversations/${conversationId}/chat`, body),
    cancelRemote: id => request('POST', `/requests/${id}/cancel`),
    requestId,
    onError: () => {},
    onCancelled: message => notify(message),
  })
  const conversations = ref<Conversation[]>([])
  const activeConversation = computed(() => conversations.value.find(c => c.id === workspace.activeId.value) || null)
  // A local draft shell: not persisted until the first send creates the real conversation.
  const DRAFT_PREFIX = 'draft:'
  const isDraftKey = (id: string) => id.startsWith(DRAFT_PREFIX)
  const isDrafting = computed(() => isDraftKey(workspace.activeId.value))
  const creatingDrafts = ref<string[]>([])
  const draftCreationCancelled = new Set<string>()
  const drawer = ref<'' | 'list' | 'summary' | 'memories' | 'direction' | 'details'>('')
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
  const pendingText = computed({ get: () => workspace.active.value.pendingText.value, set: value => { workspace.active.value.pendingText.value = value } })
  const creatingConversation = computed(() => creatingDrafts.value.includes(workspace.activeId.value))
  const sending = computed(() => workspace.active.value.sending.value)
  watch(sending, async value => {
    if (!value || tab.value !== 'chat' || workspace.active.value.sendingTask.value === 'summary') return
    uni.hideKeyboard()
    await nextTick()
    uni.pageScrollTo({ selector: '#pending-message', duration: 0 })
  })
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
  watch(() => messages.value.length, async (length, previous) => {
    if (tab.value !== 'chat' || length <= previous) return
    await nextTick()
    uni.pageScrollTo({ selector: `#message-${length - 1}`, duration: 160 })
  })
  const experimentEditor = reactive<Experiment>({ action: '', tests: '', effort: '', stop_rule: '' })
  let experimentBase: Card | null = null
  let experimentVersion = 0
  const canSaveExperiment = computed(() => experimentFields.every(f => experimentEditor[f.key].trim()) &&
    !!experimentBase && experimentProposal(experimentBase, experimentEditor).next_step.length <= 600)
  const selectedMode = computed(() => canonicalSupportStyle(activeConversation.value?.support_style || user.value?.support_style))
  const welcomeContext = computed(() => current.value?.focus_response || current.value?.actual_question || current.value?.background || '')
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

  function notify(message: string) {
    toast.value = message
    setTimeout(() => {
      toast.value = ''
    }, 2800)
  }

  function clearSession() {
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

  const discovery = useDiscovery(user, request, notify)
  const bloomMoment = useBloomMoment(user, request, requestId)
  watch(() => [user.value?.id, tab.value, screen.value], () => {
    if (user.value && screen.value === 'space' && tab.value === 'now') void bloomMoment.load()
  }, { flush: 'post' })
  onShow(() => { if (user.value && screen.value === 'space' && tab.value === 'now') void bloomMoment.load() })
  function chatAboutMoment() {
    const content = bloomMoment.moment.value?.content
    if (!content || !user.value) return
    // A separate draft; no old conversation, memory or card is silently changed.
    current.value = null
    startNewChat()
    workspace.active.value.draft.value = momentDraft(content)
  }

  const api = createApi(options => uni.request({...options, success: options.success, fail: options.fail}),
      () => token.value, clearSession, import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api')

  async function request<T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, data?: unknown) {
    return api.request<T>(method, path, data).promise
  }

  async function guarded(action: () => Promise<void>, scope: OperationScope = 'data') {
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
    if (current.value) {
      screen.value = 'space'
      // A draft shell survives restarts in memory only; never restore it from storage.
      const savedId = user.value ? uni.getStorageSync(selectedConversationKey(user.value.id)) : ''
      const restoreId = isDraftKey(workspace.activeId.value) ? '' : workspace.activeId.value
      const selected = conversations.value.find(c => c.id === (restoreId || savedId)) || conversations.value.find(c => c.issue_id === current.value?.id && !c.archived_at)
      if (selected) await activateConversation(selected, false)
    } else {
      // A returning account may have only ended explorations. It still lands at home.
      archives.value = await request<Issue[]>('GET', '/issues')
      const paused = !!user.value && !!uni.getStorageSync(pauseKeyFor(user.value.id))
      screen.value = signedInScreen(false, archives.value.length > 0, paused)
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
    if (ready.value && offline.value) void initialize()
    if (journeyChanged && user.value && ready.value && !offline.value) {
      journeyChanged = false
      void guarded(async () => {
        await refreshWorkspace()
        if (current.value) current.value = await request<Issue>('GET', `/issues/${current.value.id}`)
        if (tab.value === 'discover') await discovery.load()
      })
    }
  })
  onHide(() => {
    for (const key of creatingDrafts.value) draftCreationCancelled.add(key)
    workspace.cancelAll()
  })

  async function saveInitial() {
    current.value = await request<Issue>('POST', '/issues', form)
    if (user.value && form.support_style) user.value.support_style = form.support_style
    await refreshWorkspace()
    const first = conversations.value.find(c => c.issue_id === current.value?.id)
    if (first) await activateConversation(first, false)
    screen.value = 'space'
    tab.value = 'now'
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
    Object.assign(form, draftForm)
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
    if (nextTab === 'chat' && !current.value && !isDrafting.value) { beginOnboarding(); return }
    if (tab.value === nextTab) return
    error.value = '';
    if (nextTab !== 'chat') modePickerOpen.value = false
    tab.value = nextTab
    await nextTick()
    uni.pageScrollTo({scrollTop: 0, duration: 0})
    if (nextTab === 'discover') void discovery.load()
    if (nextTab === 'settings') await guarded(async () => {
      usage.value = await request('GET', '/usage')
    })
    if (nextTab === 'chat' && !activeConversation.value && !isDrafting.value && current.value && !current.value.ended_at) startNewChat()
  }

  function openEditor(proposal = false) {
    if (!current.value) return
    const source = proposal && suggestion.value ? mergeSuggestion(current.value.card, suggestion.value) : current.value.card
    editor.title = source.title;
    editor.next_step = source.next_step
    for (const field of editFields) editor[field.key] = source[field.key].join('\n')
    editorVersion.value = current.value.version
    error.value = '';
    modal.value = 'edit'
  }

  async function saveEditor() {
    if (!current.value) return
    await guarded(async () => {
      const updated = {title: editor.title.trim(), next_step: editor.next_step.trim()} as Card
      for (const field of editFields) updated[field.key] = editor[field.key].split('\n').map(v => v.trim()).filter(Boolean)
      current.value = await request('PUT', `/issues/${current.value!.id}/card`, {
        version: editorVersion.value,
        card: updated
      })
      modal.value = '';
      suggestion.value = null;
      notify('已保存你确认的内容')
    })
  }

  async function reloadVersion() {
    if (!current.value) return
    await guarded(async () => {
      current.value = await request('GET', `/issues/${current.value!.id}`);
      editorVersion.value = current.value!.version;
      notify('已读取最新版本，你的编辑内容仍保留，请核对后再保存')
    })
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
    if (sending.value || creatingConversation.value || !session.draft.value.trim() || readOnlyConversation.value || !user.value) return
    if (!activeConversation.value && !isDrafting.value) return
    if (!user.value.ai_consent) { modal.value = 'ai'; return }
    const account = user.value.id, sessionToken = token.value
    const context = workspace.drafts[key]
    operations.clear('ai'); session.error.value = ''
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
    workspace.active.value.error.value = ''
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
    if (!save && !await confirm('关闭聊天保存', '已保存的聊天和会话总结也会被清除；你确认的长期记忆、决策卡和反馈会保留，可分别管理')) return
    await guarded(async () => {
      user.value = await request('PUT', '/me', {save_chat: save});
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
    if (!user.value || screen.value !== 'space' || applyingTheme.value) return
    if (user.value.theme === theme && manualThemeChosen()) return
    const accountId = user.value.id
    const previousTheme = user.value.theme
    error.value = ''
    applyingTheme.value = theme
    // Apply the choice immediately. An unrelated data request must not make the
    // appearance controls feel unresponsive; a failed save rolls the choice back.
    user.value = {...user.value, theme}
    manualThemePreference.markChosen(accountId)
    try {
      await request<User>('PUT', '/me', {theme})
    } catch (err) {
      if (user.value?.id === accountId) user.value = {...user.value, theme: previousTheme}
      error.value = err instanceof Error ? err.message : '主题暂时没有保存，请稍后重试'
    } finally { applyingTheme.value = null }
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
    const change = draftChangeFor(draft.value, prompt)
    if (change === 'confirm-replace') {
      const approved = await new Promise<boolean>(resolve => uni.showModal({
        title: '替换当前输入？',
        content: '你已经输入的文字会被新建议替换。也可以先保留原来的草稿。',
        confirmText: '替换',
        cancelText: '保留草稿',
        success: result => resolve(result.confirm),
        fail: () => resolve(false),
      }))
      if (!approved) return
    }
    if (change !== 'unchanged') draft.value = prompt
    starterHint.value = '已放入输入框，可以修改后再发送'
  }

  function updateDraft(value: string) {
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
    await guarded(async () => {
      await refreshWorkspace(); drawer.value = 'list'
    })
  }

  async function refreshWorkspace() {
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
    archives.value = issues; conversations.value = [...live, ...archived]
  }
  function changedConversation(item: Conversation) {
    const index = conversations.value.findIndex(c => c.id === item.id)
    if (index < 0) conversations.value.unshift(item); else conversations.value[index] = item
    if (item.archived_at) workspace.get(item.id).cancel()
  }
  async function deletedConversation(id: string) {
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
  async function activateConversation(item: Conversation, navigate = true) {
    const session = workspace.get(item.id)
    const issue = await request<Issue>('GET', `/issues/${item.issue_id}`)
    if (!session.loaded.value) {
      const page = await request<{ items: ChatMessage[]; next_cursor: string | null }>('GET', `/conversations/${item.id}/messages`)
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
  }
  async function selectConversation(item: Conversation) { await guarded(() => activateConversation(item)) }
  async function selectExploration(issue: Issue) {
    await guarded(async () => {
      current.value = await request('GET', `/issues/${issue.id}`)
      const first = conversations.value.find(c => c.issue_id === issue.id && !c.archived_at) || conversations.value.find(c => c.issue_id === issue.id)
      if (first) await activateConversation(first, false)
      else workspace.activeId.value = ''
      tab.value = 'now'; drawer.value = ''
    })
  }
  async function resumeExploration() { if (!current.value) return; await guarded(async () => { current.value = await request('POST', `/issues/${current.value!.id}/resume`); await refreshWorkspace(); notify('探索已恢复') }) }
  function beginAnotherExploration() { drawer.value = ''; Object.assign(form, newOnboarding()); beginOnboarding() }
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
    if (!session.lastRequestId.value) return
    await guarded(async () => {
      const status = await request<{ status: string; recoverable: boolean }>('GET', `/requests/${session.lastRequestId.value}`)
      if (status.status === 'pending') { notify('请求仍在处理中，请稍后再查看'); return }
      if (status.recoverable) {
        const page = await request<{ items: ChatMessage[]; next_cursor: string | null }>('GET', `/conversations/${id}/messages`)
        const last = page.items[page.items.length - 1]
        session.messages.value = page.items; session.olderCursor.value = page.next_cursor; session.error.value = ''
        session.suggestion.value = last?.payload?.suggestion || null
        session.insight.value = last?.payload?.insight || null; session.insightReaction.value = ''
        session.phaseChange.value = null; session.phaseConfirmed.value = false; session.phaseOpen.value = false
        session.closeEdit()
        const conversation = await request<Conversation>('GET', `/conversations/${id}`)
        session.summary.value = conversation.summary; session.summaryDraft.value = null
        notify('已读取保存的回复，输入草稿仍保留')
      } else notify('没有可恢复的已保存回复；不会自动再次调用模型')
    })
  }

  async function logOut() {
    const approved = await confirm('退出登录', '退出后本机的草稿和开场进度会保留，登录后可以继续')
    if (!approved) return
    await guarded(async () => {
      if (config.value.dev_auth && user.value && demoCredential.value?.userId !== user.value.id) {
        try {
          const result = await request<{ resume_token: string }>('POST', '/auth/dev/remember', { privacy_accepted: true })
          rememberDemo(user.value.id, result.resume_token)
        } catch { /* Existing WeChat accounts use their own sign-in path. */ }
      }
      await request('POST', '/auth/logout');
      clearSession()
    })
  }

  async function deleteAccount() {
    if (!await confirm('删除我的全部记录', '账号、卡片、反馈和已保存的聊天将被永久删除，无法撤销')) return
    await guarded(async () => {
      const id = user.value?.id;
      await request('DELETE', '/me');
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
  async function explorePrompt(item: DiscoveryRecommendation) {
    if (openingDiscovery || tab.value !== 'discover' || !user.value || discovery.loading.value) return
    if (!discovery.recommendations.value.some(value => value.id === item.id)) return
    openingDiscovery = true
    const account = user.value.id
    try {
      // Confirm ownership/current status before attaching an existing topic.
      const issue = item.issueId ? await request<Issue>('GET', `/issues/${item.issueId}`) : null
      if (user.value?.id !== account || tab.value !== 'discover') return
      if (issue?.ended_at) { notify('这段探索已经结束，请先在走过的路中回看'); await discovery.load(); return }
      current.value = issue
      startNewChat()
      const key = workspace.activeId.value, context = workspace.drafts[key]
      if (context) { context.recommendation = item; workspace.get(key).draft.value = item.question }
    } catch (err) { notify(err instanceof Error ? err.message : '暂时无法打开这段探索') }
    finally { openingDiscovery = false }
  }

  return {
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
    chatError,
    offline,
    toast,
    preview,
    activeTheme,
    activeThemeStyle,
    dark,
    applyingTheme,
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
    pendingText,
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
    chatAboutMoment,
    newChatStarters,
    todayLabel,
    greeting,
    canonicalSupportStyle,
  }
}

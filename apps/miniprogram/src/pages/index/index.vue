<script setup lang="ts">
import {computed, nextTick, onMounted, onUnmounted, reactive, ref, watch} from 'vue'
import {onHide, onReady, onShow} from '@dcloudio/uni-app'
import {makePreview, mergeSuggestion, experimentProposal} from '../../domain'
import {newOnboarding, supportStyles, canonicalSupportStyle} from '../../onboarding'
import type {SupportMode} from '../../onboarding'
import {chatEntryFor, draftChangeFor} from '../../chat-entry'
import OnboardingFlow from '../../components/OnboardingFlow.vue'
import WelcomeOpening from '../../components/WelcomeOpening.vue'
import AuthWelcome from '../../components/AuthWelcome.vue'
import { OPENING_KEY, initialScreen, signedInScreen, draftKeyFor, pauseKeyFor } from '../../entry'
import type { EntryScreen } from '../../entry'
import ActionButton from '../../components/ActionButton.vue'
import EmptyState from '../../components/EmptyState.vue'
import SvgIcon from '../../components/SvgIcon.vue'
import CompanionAvatar from '../../components/CompanionAvatar.vue'
import {iconSources} from '../../icons'
import {themes, navigationItems, themeForSession, themeStyle, themeNavSvg} from '../../themes'
import type {ThemeId, SpaceTab} from '../../themes'
import ThemePreview from '../../components/ThemePreview.vue'
import type {Card, ChatMessage, Issue, Onboarding, User, Experiment, Conversation, ConversationSummary, SuppliedContext} from '../../domain'
import {ApiError, createApi} from '../../http'
import {createOperationState} from '../../operations'
import type {OperationScope} from '../../operations'
import {createChatWorkspace} from '../../chat-workspace'
import ConversationDrawer from '../../components/ConversationDrawer.vue'
import {createAvatarStore} from '../../avatar'

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
const activeTheme = computed(() => themeForSession(user.value, screen.value === 'space'))
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
let draftSequence = 0
const drawer = ref<'' | 'list' | 'summary' | 'memories' | 'details'>('')
const openedIds = ref<string[]>([])
const windows = computed(() => openedIds.value.map(id => conversations.value.find(c => c.id === id)).filter((c): c is Conversation => !!c))
const runningIds = computed(() => Object.entries(workspace.sessions).filter(([, session]) => session.sending.value).map(([id]) => id))
const messages = computed({ get: () => workspace.active.value.messages.value, set: value => { workspace.active.value.messages.value = value } })
const draft = computed({ get: () => workspace.active.value.draft.value, set: value => { workspace.active.value.draft.value = value } })
const pendingText = computed({ get: () => workspace.active.value.pendingText.value, set: value => { workspace.active.value.pendingText.value = value } })
const sending = computed(() => workspace.active.value.sending.value)
const suggestion = computed({ get: () => workspace.active.value.suggestion.value, set: value => { workspace.active.value.suggestion.value = value } })
const insight = computed({ get: () => workspace.active.value.insight.value, set: value => { workspace.active.value.insight.value = value } })
const insightReaction = computed(() => workspace.active.value.insightReaction.value)
const generatingSummary = computed(() => sending.value && workspace.active.value.sendingTask.value === 'summary')
const readOnlyConversation = computed(() => !!activeConversation.value?.archived_at || !!current.value?.ended_at)
// Per-reply disclosure: what was actually handed to the model for this turn.
const disclosedContext = ref<Record<string, SuppliedContext | null>>({})
const disclosureOpen = ref<Record<string, boolean>>({})
function contextForMessage(message: ChatMessage, index: number): SuppliedContext | null {
  const key = message.id || `index-${index}`
  if (key in disclosedContext.value) return disclosedContext.value[key]
  return message.role === 'assistant' ? (message.payload?.supplied_context ?? null) : null
}
function toggleDisclosure(message: ChatMessage, index: number) {
  const key = message.id || `index-${index}`
  if (!(key in disclosedContext.value)) disclosedContext.value[key] = message.payload?.supplied_context ?? null
  disclosureOpen.value[key] = !disclosureOpen.value[key]
}
const memoryCategoryLabels: Record<SuppliedContext['memories'][number]['category'], string> = { fact: '事实', preference: '偏好', constraint: '约束' }
watch(() => workspace.activeId.value, () => { disclosedContext.value = {}; disclosureOpen.value = {} })
// Animate only genuinely new assistant replies. Restored history remains still.
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
const experimentFields = [
  { key: 'action', label: '我愿意试的事情', max: 200 }, { key: 'tests', label: '想验证什么', max: 200 },
  { key: 'effort', label: '时间、精力与资源上限', max: 120 }, { key: 'stop_rule', label: '什么时候可以停下来', max: 120 },
] as const
let experimentBase: Card | null = null
let experimentVersion = 0
const canSaveExperiment = computed(() => experimentFields.every(f => experimentEditor[f.key].trim()) &&
  !!experimentBase && experimentProposal(experimentBase, experimentEditor).next_step.length <= 600)
const selectedMode = computed(() => canonicalSupportStyle(activeConversation.value?.support_style || user.value?.support_style))
const welcomeContext = computed(() => current.value?.focus_response || current.value?.actual_question || current.value?.background || '')
const chatEntry = computed(() => chatEntryFor(selectedMode.value, current.value || {}))
const modePickerOpen = ref(false)
const starterHint = ref('')
// Chat-header menu: management actions live behind ···, not as resident buttons.
const chatMenuOpen = ref(false)
function closeChatMenu() { chatMenuOpen.value = false }
function openChatMenu() { if (!chatMenuOpen.value) chatMenuOpen.value = true }
// New ChatGPT-style draft shell: a clean welcome page that stays local until
// the first real send, so abandoned opens never create empty conversations.
const newChatStarters = [
  '我想聊聊最近困扰我的事',
  '帮我比较几个选择',
  '给我一个没想过的新角度',
]
function startNewChat() {
  if (!current.value || current.value.ended_at) return
  // Drop empty draft shells so repeated "new chat" taps don't accumulate.
  for (const key of Object.keys(workspace.sessions)) {
    if (isDraftKey(key) && !workspace.sessions[key].messages.value.length && !workspace.sessions[key].draft.value.trim()) {
      workspace.remove(key)
      openedIds.value = openedIds.value.filter(id => id !== key)
    }
  }
  const key = `${DRAFT_PREFIX}${Date.now()}-${++draftSequence}`
  workspace.get(key)
  workspace.activeId.value = key
  if (!openedIds.value.includes(key)) openedIds.value.push(key)
  modePickerOpen.value = false; starterHint.value = ''; chatMenuOpen.value = false
  drawer.value = ''; tab.value = 'chat'
  void nextTick(() => uni.pageScrollTo({ scrollTop: 0, duration: 0 }))
}
function chatMenuAction(action: 'preference' | 'summary' | 'details' | 'archive') {
  chatMenuOpen.value = false
  if (action === 'preference') { modePickerOpen.value = true; return }
  if (action === 'summary') { drawer.value = 'summary'; return }
  if (action === 'details') { drawer.value = 'details'; return }
  if (activeConversation.value && !readOnlyConversation.value) void archiveFromChat()
}
async function archiveFromChat() {
  const item = activeConversation.value
  if (!item) return
  const approved = await new Promise<boolean>(resolve => uni.showModal({
    title: '归档这段会话？',
    content: '会话会移入归档列表，所属探索继续保留。未开启聊天保存时，原文只在本次使用中可见',
    confirmText: '归档',
    cancelText: '再想想',
    success: result => resolve(result.confirm),
    fail: () => resolve(false),
  }))
  if (!approved) return
  await guarded(async () => {
    const updated = await request<Conversation>('PUT', `/conversations/${item.id}`, { version: item.version, archived: true })
    changedConversation(updated)
    await refreshWorkspace()
  })
}
const chatStarters = computed(() => chatEntry.value.starters.slice(0, 2))
watch(() => tab.value, closeChatMenu)

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
const usage = ref({used_cny: 0, limit_cny: 20, daily_calls: 0, daily_limit: 30, mode: 'demo'})
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
const editFields = [
  {key: 'options', label: '正在考虑的方向', hint: '每行一个；暂时没有也没关系'},
  {key: 'constraints', label: '现实约束', hint: '时间、收入、地点或其他重要条件'},
  {key: 'confirmed', label: '我确认的信息', hint: '只留下你认为准确的内容'},
  {key: 'hypotheses', label: '可能性 · 尚未证实', hint: '推测可以保留，也可以删掉'},
  {key: 'unknowns', label: '还需要了解的', hint: '每行一个需要核实的问题'},
] as const

function notify(message: string) {
  toast.value = message
  setTimeout(() => {
    toast.value = ''
  }, 2800)
}

function clearSession() {
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

onMounted(initialize)
onShow(() => { if (ready.value && offline.value) void initialize() })
onHide(() => {
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
  if (nextTab === 'chat' && !current.value) { beginOnboarding(); return }
  if (tab.value === nextTab) return
  error.value = '';
  if (nextTab !== 'chat') modePickerOpen.value = false
  tab.value = nextTab
  await nextTick()
  uni.pageScrollTo({scrollTop: 0, duration: 0})
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
  if (sending.value || !draft.value.trim() || readOnlyConversation.value) return
  if (!current.value) return
  if (!activeConversation.value && !isDrafting.value) return
  if (!user.value?.ai_consent) {
    modal.value = 'ai';
    return
  }
  operations.clear('ai')
  // A draft shell becomes a real conversation only on the first send.
  let conversationId = activeConversation.value?.id
  if (!conversationId) {
    const draftKey = workspace.activeId.value
    try {
      const created = await request<Conversation>('POST', '/conversations', {
        issue_id: current.value.id,
        title: draft.value.trim().slice(0, 30) || '新会话',
        support_style: canonicalSupportStyle(selectedMode.value),
      })
      conversationId = created.id
      conversations.value.unshift(created)
      workspace.promote(draftKey, created.id)
      if (user.value) { try { uni.setStorageSync(selectedConversationKey(user.value.id), created.id) } catch { /* A presentation preference may stay in memory. */ } }
    } catch (err) {
      if (err instanceof ApiError && ['network', 'timeout'].includes(err.kind)) notify('暂时无法连接服务，你的输入仍保留在输入框')
      throw err
    }
  }
  await workspace.get(conversationId).send(conversationId)
  if (user.value) await guarded(refreshWorkspace)
}

function cancelChat() {
  workspace.active.value.cancel()
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
    }
    await refreshWorkspace()
    notify(save ? '之后的聊天会保存到你的账号' : '已关闭，并清除已保存的聊天记录')
  })
}

async function setTheme(theme: ThemeId) {
  if (!user.value || screen.value !== 'space' || busy.value || applyingTheme.value || user.value.theme === theme) return
  applyingTheme.value = theme
  try { await guarded(async () => { user.value = await request('PUT', '/me', {theme}) }) }
  finally { applyingTheme.value = null }
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
  if (mode === selectedMode.value) { modePickerOpen.value = false; return }
  await guarded(async () => {
    changedConversation(await request<Conversation>('PUT', `/conversations/${activeConversation.value!.id}`, { version: activeConversation.value!.version, support_style: mode }))
    modePickerOpen.value = false
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
      session.messages.value = page.items; session.olderCursor.value = page.next_cursor; session.error.value = ''; notify('已读取保存的回复，输入草稿仍保留')
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
      try { uni.removeStorageSync(draftKeyFor(id)); uni.removeStorageSync(pauseKeyFor(id)); uni.removeStorageSync(selectedConversationKey(id)) }
      catch { /* A local storage failure must not keep a deleted account signed in. */ }
    }
    if (id) await localAvatars.clear(id);
    clearSession();
    notify('你的个人记录已删除')
  })
}

const todayLabel = new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' })
const greeting = new Date().getHours() < 12 ? '早安，按自己的节奏来' : new Date().getHours() < 18 ? '午后好，给自己一点空间' : '晚上好，今天辛苦了'
const discoveryPrompts = [
  { icon: 'compass', label: '辨认意愿', title: '如果少一点比较', question: '如果没有别人的赞许，我依然愿意把时间交给什么？' },
  { icon: 'paths', label: '看见选择', title: '想要的自由，有什么模样', question: '现在的努力，会让我拥有哪一种具体的选择？为此付出的代价，我还愿意承担吗？' },
  { icon: 'sun', label: '从体验出发', title: '什么让我想再来一次', question: '最近有没有一个时刻，让我感到投入、舒展，或愿意再经历一次？' },
]
async function explorePrompt(question: string) {
  if (!current.value) { beginOnboarding(); return }
  await selectTab('chat')
  await useChatStarter(question)
}

const prettyDate = (date: string) => new Date(date).toLocaleDateString('zh-CN', {month: 'long', day: 'numeric'})
</script>

<template>
  <view class="preview-stage"
        :class="['theme-' + activeTheme.id, { dark, 'theme-space': screen === 'space', 'theme-home': screen === 'space' && tab === 'now', 'keyboard-open': keyboardHeight > 0 }]"
        :style="{ ...activeThemeStyle, '--keyboard-height': `${keyboardHeight}px`, '--status-bar-height': `${statusHeight}px`, '--capsule-bottom': `${capsuleBottom}px` }">
    <view class="app-shell"
          :class="{ 'with-tabs': screen === 'space', 'chat-page': tab === 'chat' && screen === 'space', 'onboarding-shell': screen !== 'space' }">
      <view v-if="screen === 'space'" class="theme-atmosphere" :class="{ 'theme-atmosphere-faint': tab !== 'now' }" aria-hidden="true">
        <image :src="activeTheme.image" mode="aspectFill"/><view class="theme-atmosphere-wash"/>
      </view>
      <view v-if="screen === 'space' && tab !== 'chat'" class="topbar">
        <button class="icon-button" aria-label="打开会话与探索" hover-class="pressed" :hover-start-time="0"
                :hover-stay-time="70" @click="showHistory">
          <image class="topbar-glyph" :src="iconSources.menu.ink" mode="aspectFit" aria-hidden="true" />
        </button>
        <view class="brand-lockup" aria-label="Agency Bloom">
          <image class="brand-lockup-symbol"
                 :src="dark ? '/static/brand-sprout-night.png' : '/static/brand-sprout.png'"
                 mode="aspectFit" />
          <text class="space-wordmark">AGENCY BLOOM</text>
        </view>
        <button class="icon-button" aria-label="打开我的设置" hover-class="pressed" :hover-start-time="0"
                :hover-stay-time="70" @click="selectTab('settings')">
          <image class="topbar-glyph" :src="iconSources.user.ink" mode="aspectFit" aria-hidden="true" />
        </button>
      </view>
      <view v-if="error && !modal && screen === 'space'" class="notice error-notice">
        <text>{{ error }}</text>
        <button v-if="!ready" class="text-button" @click="initialize" hover-class="pressed" :hover-start-time="0"
                :hover-stay-time="70">重新连接
        </button>
        <button class="notice-close" aria-label="关闭提示" @click="error = ''" hover-class="pressed"
                :hover-start-time="0" :hover-stay-time="70">
          <SvgIcon name="close" :size="20"/>
        </button>
      </view>

      <view v-if="screen === 'restore'" class="entry-status">
        <text class="eyebrow">AGENCY BLOOM</text>
        <text class="page-title">{{ offline || error ? '连接暂时停了一下' : '正在回到你的空间' }}</text>
        <text class="body-copy">{{ operations.errors.init || error || '稍等片刻，我们正在恢复上次的进展。' }}</text>
        <ActionButton v-if="offline || error" :loading="busy || operations.busy.init" @click="initialize">重新连接</ActionButton>
        <button v-if="offline || error" class="text-button" :disabled="busy" @click="clearSession">返回登录</button>
      </view>
      <WelcomeOpening v-else-if="screen === 'opening'" @start="finishOpening" />
      <AuthWelcome v-else-if="screen === 'auth'" :theme="activeTheme" :busy="busy" :error="authError"
        :dev-auth="config.dev_auth" :has-demo="!!demoCredential" :wechat-auth="config.wechat_auth" :offline="offline"
        :connecting="operations.busy.init" :ready="ready" @login="authenticate"
        @replay="screen = 'opening'" @privacy="modal = 'privacy'" @retry="initialize" />
      <OnboardingFlow v-else-if="screen === 'onboard' && user" :key="user.id" :user-id="user.id"
        :busy="busy" :error="authError" @save="saveQuestions" @skip="pauseOnboarding"
        @privacy="modal = 'privacy'" @navigate="operations.clear('auth')" />

      <template v-else-if="screen === 'space'">
        <view v-if="current && tab === 'now'" class="workspace home-dashboard">
          <view class="home-heading hero-heading">
            <text class="hero-eyebrow">{{ greeting }}</text>
            <text class="hero-title">欢迎回到你的生活</text>
            <text class="hero-subtitle">{{ '每一次选择\n都可以更靠近自己的意愿' }}</text>
            <text class="hero-aside">{{ '远处有方向\n此刻也有生活' }}</text>
          </view>
          <button class="home-mission glass-card" data-home="mission" @click="openEditor()" hover-class="pressed" :hover-start-time="0">
            <view><text class="mission-label">此刻，我在意的</text><text class="mission-title">{{ card.title || current.title || '一次还未命名的探索' }}</text><text class="mission-detail">{{ current.focus_response || '方向可以慢慢清晰，也可以重新选择' }}</text></view>
            <SvgIcon name="chevron" :size="18" />
          </button>
          <view class="home-focus-card glass-card">
            <view class="focus-card-heading"><text>今日聚焦</text><text>{{ todayLabel }}</text></view>
            <button class="focus-row" data-home="plan" @click="selectTab('plan')" hover-class="pressed" :hover-start-time="0">
              <view class="focus-symbol"><SvgIcon name="step" :size="19" /></view>
              <view class="focus-row-copy"><text>{{ card.next_step || '找到一个愿意尝试的小改变' }}</text><text>{{ card.next_step ? '你已确认的下一步，随时可以调整' : '从时间和精力允许的一步开始' }}</text></view><text class="focus-tag">计划</text>
            </button>
            <button class="focus-row" data-home="reflect" @click="modal = 'feedback'" hover-class="pressed" :hover-start-time="0">
              <view class="focus-symbol"><SvgIcon name="note" :size="19" /></view>
              <view class="focus-row-copy"><text>留意今天的真实感受</text><text>一点发现，或只是想停一停</text></view><text class="focus-tag">记录</text>
            </button>
            <button class="focus-row" data-home="chat" @click="selectTab('chat')" hover-class="pressed" :hover-start-time="0">
              <view class="focus-symbol"><SvgIcon name="chat" :size="19" /></view>
              <view class="focus-row-copy"><text>把挂心的事，慢慢说清楚</text><text>接着上一次，也可以换个话题</text></view><text class="focus-tag">对话</text>
            </button>
          </view>
          <view class="home-quote"><text class="quote-mark">“</text><view><text>{{ '未来值得争取\n此刻的生活，也值得被照顾' }}</text><text class="quote-signature">— Agency Bloom</text></view></view>
        </view>

        <view v-else-if="current && tab === 'plan'" class="workspace plan-content">
          <view class="section-intro"><text class="eyebrow">ONE SMALL STEP</text><text class="page-title">{{ '为下一步\n留一点空间' }}</text><text class="page-description">这里保留你确认的方向、行动和新的发现</text></view>
          <view v-if="!card.next_step" class="plan-empty glass-card"><text class="card-title">还没有决定下一步，也没关系</text><text class="body-copy">先写下一件愿意试的事，或和我一起想一想</text><button class="text-button" @click="openEditor()">整理我的卡片 <SvgIcon name="arrow" :size="17" /></button><button class="text-button" @click="selectTab('chat')">一起聊聊 <SvgIcon name="chat" :size="17" /></button></view>
          <view v-if="card.next_step" class="next-card">
            <text class="eyebrow">我愿意尝试的下一步</text>
            <text class="next-title">{{ card.next_step }}</text>
            <button class="text-button" @click="modal = 'feedback'" hover-class="pressed" :hover-start-time="0"
                    :hover-stay-time="70">记下后来的变化
              <SvgIcon name="arrow" :size="17"/>
            </button>
          </view>
          <view class="section-row">
            <text class="section-title">我的决策卡</text>
            <button class="text-button" @click="openEditor()" hover-class="pressed" :hover-start-time="0"
                    :hover-stay-time="70">编辑
              <SvgIcon name="arrow-diagonal" :size="17"/>
            </button>
          </view>
          <view class="paper-card">
            <view class="paper-top">
              <text class="eyebrow">正在跟进</text>
              <view class="live-dot"/>
            </view>
            <text class="card-title">{{ card.title || '这次探索，还可以继续' }}</text>
            <view class="card-rule"/>
            <view v-for="field in editFields" :key="field.key" class="card-section">
              <text class="card-label" :class="field.key">{{ field.label }}</text>
              <text v-for="(line, index) in card[field.key]" :key="index" class="card-line">{{ line }}</text>
              <text v-if="!card[field.key].length" class="muted small">
                {{ field.key === 'options' ? '先探索，再慢慢形成选项' : '等你愿意时，再补充' }}
              </text>
            </view>
            <view class="paper-footer">
              <text>由你确认 · 随时可改</text>
              <text>{{ prettyDate(current.updated_at) }}</text>
            </view>
          </view>
          <view class="section-row">
            <text class="section-title">一路上的变化</text>
            <button class="text-button" @click="modal = 'feedback'" hover-class="pressed" :hover-start-time="0"
                    :hover-stay-time="70">
              <SvgIcon name="plus" :size="15"/>
              记录
            </button>
          </view>
          <view v-if="!current.feedback.length" class="home-empty">
            <image class="home-entry-glyph" :src="iconSources.note.ink" mode="aspectFit"/>
            <text>每一点新的发现，都可以留在这里</text>
          </view>
          <view v-for="entry in current.feedback" :key="entry.id" class="timeline-entry">
            <view class="timeline-dot"/>
            <view>
              <text class="muted small">{{ prettyDate(entry.created_at) }} ·
                {{ entry.kind === 'progress' ? '有了新进展' : entry.kind === 'stuck' ? '遇到一点阻碍' : '想法变了' }}
              </text>
              <text class="body-copy">{{ entry.text }}</text>
            </view>
          </view>
          <button v-if="current.ended_at" class="secondary" @click="resumeExploration">恢复这个探索</button>
          <button v-else class="text-button end-link" @click="endIssue" hover-class="pressed" :hover-start-time="0"
                  :hover-stay-time="70">结束这件事，给新的方向留空间
          </button>
        </view>

        <view v-else-if="current && tab === 'chat'" class="chat-content">
          <view class="chat-header">
            <button class="chat-header-button" aria-label="打开会话列表" hover-class="pressed" :hover-start-time="0"
                    :hover-stay-time="70" @click="showHistory">
              <SvgIcon name="back" :size="20"/>
            </button>
            <button class="chat-header-title" :disabled="busy" aria-label="打开会话列表" hover-class="pressed"
                    :hover-start-time="0" :hover-stay-time="70" @click="showHistory">
              <text class="chat-header-name">{{ isDrafting ? '新会话' : activeConversation?.title || chatEntry.heading }}</text>
              <view class="chat-header-chevron"><SvgIcon name="chevron" :size="13"/></view>
            </button>
            <view class="chat-header-right">
              <view v-if="runningIds.length" class="chat-header-running" aria-label="有回复正在生成">◌</view>
              <button class="chat-header-button" :aria-expanded="chatMenuOpen" aria-haspopup="menu"
                      aria-label="会话管理" hover-class="pressed" :hover-start-time="0"
                      :hover-stay-time="70" @click="chatMenuOpen ? closeChatMenu() : openChatMenu()">
                <SvgIcon name="more" :size="20"/>
              </button>
            </view>
          </view>
          <view v-if="chatMenuOpen" class="chat-menu" role="menu">
            <button class="chat-menu-item" role="menuitem" :disabled="busy || sending || (!activeConversation && !isDrafting)" @click="chatMenuAction('preference')" hover-class="pressed" :hover-start-time="0" :hover-stay-time="70">
              <text>回应偏好</text><text class="chat-menu-hint">{{ supportStyles.find(item => item.id === selectedMode)?.title }}</text>
            </button>
            <button class="chat-menu-item" role="menuitem" :disabled="busy || !activeConversation" @click="chatMenuAction('summary')" hover-class="pressed" :hover-start-time="0" :hover-stay-time="70">
              <text>整理当前会话</text><text class="chat-menu-hint">生成总结草稿</text>
            </button>
            <button class="chat-menu-item" role="menuitem" :disabled="busy || !activeConversation" @click="chatMenuAction('details')" hover-class="pressed" :hover-start-time="0" :hover-stay-time="70">
              <text>关联与设置</text><text class="chat-menu-hint">重命名 · 关联探索</text>
            </button>
            <button class="chat-menu-item" role="menuitem" :disabled="busy || !activeConversation || readOnlyConversation" @click="chatMenuAction('archive')" hover-class="pressed" :hover-start-time="0" :hover-stay-time="70">
              <text>归档会话</text><text class="chat-menu-hint">移入归档，探索保留</text>
            </button>
          </view>
          <view v-if="chatError" class="notice chat-error"><text>{{ chatError }}</text><button class="notice-close" aria-label="关闭对话提示" @click="workspace.active.value.error.value = ''; operations.clear('ai')"><SvgIcon name="close" :size="18" /></button><button v-if="workspace.active.value.lastRequestId.value" class="text-button" :disabled="busy" @click="recoverReply">查看这条请求的结果</button></view>
          <view v-if="readOnlyConversation" class="notice"><text>{{ current.ended_at ? '所属探索已结束，恢复探索后可以继续' : '会话已归档，可以在会话面板恢复' }}</text><button v-if="current.ended_at" class="text-button" @click="resumeExploration">恢复探索</button></view>
          <text v-if="config.ai_mode === 'demo'" class="demo-chat-note">本地演示 · 以下回复为固定示例，不调用模型</text>
          <view v-if="modePickerOpen" class="chat-mode-panel">
            <text class="chat-mode-panel-caption">只是回应偏好，随时可以更改</text>
            <button v-for="mode in supportStyles" :key="mode.id" class="chat-mode-choice"
                    :class="{ chosen: selectedMode === mode.id }" :data-mode="mode.id"
                    :disabled="busy || sending" @click="setChatMode(mode.id as SupportMode); modePickerOpen = false"
                    hover-class="pressed" :hover-start-time="0" :hover-stay-time="70">
              <view class="chat-mode-copy">
                <text class="chat-mode-name">{{ mode.title }}</text>
                <text class="chat-mode-detail">{{ mode.detail }}</text>
              </view>
              <SvgIcon v-if="selectedMode === mode.id" name="check" :size="17" />
            </button>
          </view>
          <view v-if="!messages.length && isDrafting" class="chat-welcome">
            <view class="chat-welcome-intro">
              <view class="chat-welcome-avatar"><CompanionAvatar :size="32" state="idle" /></view>
              <text class="body-copy">想说什么，就从哪里说起。发送后这段对话才会被创建。</text>
            </view>
            <text v-if="!user?.save_chat" class="welcome-context">未开启聊天保存：这段对话的原文只在本次使用中可见，不会为你伪造可恢复的历史</text>
            <text v-if="welcomeContext" class="welcome-context">{{ welcomeContext }}</text>
            <view class="chat-starter-heading">
              <text>可以这样开始</text>
              <text>点选后填入输入框</text>
            </view>
            <view class="prompt-list">
              <button v-for="prompt in newChatStarters" :key="prompt" class="prompt-button"
                      :disabled="sending || busy" @click="useChatStarter(prompt)"
                      hover-class="pressed" :hover-start-time="0" :hover-stay-time="70">
                <text>{{ prompt }}</text>
                <SvgIcon name="arrow-diagonal" :size="16" />
              </button>
            </view>
            <text v-if="starterHint" class="chat-starter-hint">{{ starterHint }}</text>
          </view>
          <view v-else-if="!messages.length && activeConversation" class="chat-welcome">
            <view class="chat-welcome-intro">
              <view class="chat-welcome-avatar"><CompanionAvatar :size="32" state="idle" /></view>
              <text class="body-copy">{{ chatEntry.introduction }}</text>
            </view>
            <text v-if="welcomeContext" class="welcome-context">{{ welcomeContext }}</text>
            <view class="chat-starter-heading">
              <text>也可以这样开始</text>
              <text>点选后填入输入框</text>
            </view>
            <view class="prompt-list">
              <button v-for="prompt in chatStarters" :key="prompt" class="prompt-button"
                      :disabled="sending || busy" @click="useChatStarter(prompt)"
                      hover-class="pressed" :hover-start-time="0" :hover-stay-time="70">
                <text>{{ prompt }}</text>
                <SvgIcon name="arrow-diagonal" :size="16" />
              </button>
            </view>
            <text v-if="starterHint" class="chat-starter-hint">{{ starterHint }}</text>
          </view>
          <button v-if="workspace.active.value.olderCursor.value" class="text-button" :disabled="busy" @click="loadOlderMessages">加载更早的消息</button>
          <view v-for="(message, index) in messages" :id="'message-' + index" :key="message.id || index" class="message-row" :class="message.role">
            <CompanionAvatar v-if="message.role === 'assistant'" :size="38"
                             :state="speakingIndex === index ? 'speaking' : (index === messages.length - 1 ? 'idle' : 'rest')" />
            <image v-else class="chat-avatar"
                   :src="userAvatar || '/static/avatar-user.png'"
                   mode="aspectFill" aria-label="你的头像"/>
            <view class="message-content">
              <text v-if="message.role === 'assistant'" class="message-name">AGENCY BLOOM</text>
              <text class="message-bubble">{{ message.content }}</text>
              <button v-if="message.role === 'assistant' && (message.payload?.supplied_context || disclosedContext[message.id || `index-${index}`])"
                      class="context-disclosure-toggle" :aria-expanded="!!disclosureOpen[message.id || `index-${index}`]"
                      @click="toggleDisclosure(message, index)" hover-class="pressed" :hover-start-time="0" :hover-stay-time="70">
                查看本次提供给 AI 的背景
                <view class="disclosure-chevron" :class="{ 'is-open': disclosureOpen[message.id || `index-${index}`] }"><SvgIcon name="chevron" :size="13"/></view>
              </button>
              <view v-if="disclosureOpen[message.id || `index-${index}`]" class="context-disclosure">
                <template v-if="contextForMessage(message, index)">
                  <text class="disclosure-heading">实际传入的背景资料</text>
                  <view v-if="contextForMessage(message, index)!.memories.length" class="disclosure-section">
                    <text class="disclosure-label">你确认过的长期记忆</text>
                    <text v-for="memory in contextForMessage(message, index)!.memories" :key="memory.id" class="disclosure-item">「{{ memory.content }}」 · {{ memoryCategoryLabels[memory.category] || memory.category }}</text>
                  </view>
                  <view v-if="contextForMessage(message, index)!.summary" class="disclosure-section">
                    <text class="disclosure-label">这段会话已审阅的总结</text>
                  </view>
                  <view class="disclosure-section">
                    <text class="disclosure-label">最近消息</text>
                    <text class="disclosure-item">{{ contextForMessage(message, index)!.history_count }} 条{{ contextForMessage(message, index)!.history_retained ? ' · 来自已保存的聊天' : ' · 来自本次使用，未保存' }}</text>
                  </view>
                  <view v-if="contextForMessage(message, index)!.linked_explorations.length" class="disclosure-section">
                    <text class="disclosure-label">关联探索的卡片</text>
                    <text v-for="issue in contextForMessage(message, index)!.linked_explorations" :key="issue.id" class="disclosure-item">「{{ issue.title || '未命名探索' }}」的已确认卡片</text>
                  </view>
                  <text class="disclosure-note">以上是本次实际提供的内容，不代表回复一定逐条使用</text>
                </template>
                <text v-else class="disclosure-note">本次回复没有附带长期记忆、总结或关联探索</text>
              </view>
            </view>
          </view>
          <view v-if="sending && !generatingSummary" class="message-row user">
            <image class="chat-avatar" :src="userAvatar || '/static/avatar-user.png'" mode="aspectFill"
                   aria-label="你的头像"/>
            <view class="message-content">
              <text class="message-bubble">{{ pendingText }}</text>
            </view>
          </view>
          <view v-if="sending" class="thinking">
            <CompanionAvatar :size="38" state="thinking" :interactive="false"/>
            <view class="thinking-copy">
              <text class="message-name">AGENCY BLOOM</text>
              <text>{{ generatingSummary ? '正在整理会话，随时可以停止' : '正在回应，随时可以停止' }}</text>
            </view>
          </view>
          <view v-if="suggestion" class="proposal-card">
            <text class="eyebrow">一个待你确认的想法</text>
            <text class="body-copy">{{ suggestion.next_step }}</text>
            <button class="text-button" @click="openEditor(true)" hover-class="pressed" :hover-start-time="0"
                    :hover-stay-time="70">查看草稿，确认后加入卡片
              <SvgIcon name="arrow-diagonal" :size="17"/>
            </button>
          </view>
          <view v-if="insight" class="insight-card">
            <view class="insight-heading"><SvgIcon name="spark" :size="20" /><text>还有一种可能</text></view>
            <text class="insight-observation">{{ insight.observation }}</text>
            <text class="insight-possibility">{{ insight.possibility }}</text>
            <text class="insight-uncertainty">{{ insight.uncertainty }}</text>
            <view class="insight-actions"><button data-insight="interested" :disabled="sending || busy || insightReaction === 'interested'" @click="reactToInsight('interested')" hover-class="pressed" :hover-start-time="0" :hover-stay-time="70">{{ insightReaction === 'interested' ? '已带入下一次探索' : '这个角度有意思' }}</button><button data-insight="dismissed" :disabled="sending || busy" @click="reactToInsight('dismissed')" hover-class="pressed" :hover-start-time="0" :hover-stay-time="70">不太像我</button><button data-insight="experiment" :disabled="sending || busy" @click="reactToInsight('experiment')" hover-class="pressed" :hover-start-time="0" :hover-stay-time="70">让我试一下 <SvgIcon name="arrow-diagonal" :size="15" /></button></view>
            <text v-if="insightReaction" class="insight-footnote">这只是待探索的角度，尚未写入你的卡片</text>
          </view>
          <view class="composer"><textarea v-model="draft" class="chat-input" :disabled="readOnlyConversation || (!activeConversation && !isDrafting)" :adjust-position="false" @input="starterHint = ''"
                                           :cursor-spacing="24" maxlength="2000" :auto-height="true"
                                           :placeholder="isDrafting ? '发送后才会创建这段对话' : '想到什么，就从哪里说起……'"/>
            <button class="send-button" :disabled="!sending && (!draft.trim() || readOnlyConversation || (!activeConversation && !isDrafting))"
                    :aria-label="sending ? '停止回复' : '发送消息'" @click="sending ? cancelChat() : sendChat()"
                    hover-class="pressed" :hover-start-time="0" :hover-stay-time="70">
              <SvgIcon :name="sending ? 'stop' : 'arrow-up'" light :size="21"/>
            </button>
          </view>
          <text class="chat-disclosure">
            {{ user?.save_chat ? '已开启聊天保存，可在「我的」中关闭并清除' : '完整聊天默认不保存 · 确认的卡片会留下' }}
          </text>
        </view>

        <view v-else-if="tab === 'discover'" class="workspace discover-content">
          <view class="section-intro"><text class="eyebrow">A DIFFERENT PERSPECTIVE</text><text class="page-title">换个角度，看看生活</text><text class="page-description">有些答案，会从一个新的问题开始</text></view>
          <button v-for="(prompt, index) in discoveryPrompts" :key="prompt.title" class="discovery-card glass-card" :data-discovery="index" @click="explorePrompt(prompt.question)" hover-class="pressed" :hover-start-time="0">
            <view class="discovery-heading"><view class="focus-symbol"><SvgIcon :name="prompt.icon" :size="22" /></view><text>{{ prompt.label }}</text><SvgIcon name="arrow-diagonal" :size="18" /></view>
            <text class="discovery-title">{{ prompt.title }}</text><text class="discovery-question">{{ prompt.question }}</text><text class="discovery-hint">{{ current ? '带着这个问题聊聊' : '先留下线索，再慢慢聊' }}</text>
          </button>
          <button class="history-entry glass-card" @click="showHistory" hover-class="pressed"><SvgIcon name="note" :size="21" /><view><text>回看走过的路</text><text>看看哪些想法，正在慢慢改变</text></view><SvgIcon name="chevron" :size="18" /></button>
        </view>

        <view v-else-if="!current && tab !== 'settings'" class="workspace empty-dashboard" :class="{ 'home-dashboard': tab === 'now' }">
          <view class="home-heading" :class="{ 'hero-heading': tab === 'now' }">
            <text class="page-title">{{ '先在这里\n给自己一点空间' }}</text>
            <text class="page-description">{{ '不必立刻回答所有问题。\n等你愿意时，我们从一件小事开始。' }}</text>
          </view>
          <view class="paper-card">
            <text class="eyebrow">按自己的节奏</text>
            <text class="card-title">最近，什么最让你挂心？</text>
            <text class="body-copy">点选几项就好。之前留在本机的回答，也可以接着整理。</text>
            <ActionButton :disabled="busy" @click="beginOnboarding">开始或继续探索</ActionButton>
          </view>
          <button class="text-button" @click="showHistory">回看走过的路 <SvgIcon name="arrow" :size="17" /></button>
        </view>

        <view v-else class="settings-content">
          <text class="eyebrow">MAKE YOURSELF AT HOME</text>
          <text class="page-title">{{ '你的空间，\n由你做主' }}</text>
          <view class="settings-group avatar-settings">
            <view class="avatar-profile">
              <image class="profile-avatar" :src="userAvatar || '/static/avatar-user.png'" mode="aspectFill"
                     @error="userAvatar = ''"/>
              <view>
                <text class="setting-title">你的对话头像</text>
                <text class="setting-description">可选，仅保存在这台设备，不发送给 AI</text>
              </view>
            </view>
            <!-- #ifdef MP-WEIXIN -->
            <button class="avatar-choose secondary" open-type="chooseAvatar" :disabled="avatarBusy"
                    @chooseavatar="chooseAvatar" hover-class="gem-choose-pressed" :hover-start-time="0" :hover-stay-time="70">
              {{ avatarBusy ? '正在保存' : '更改头像' }}
            </button>
            <!-- #endif -->
          </view>
          <view class="settings-group">
            <text class="group-label">使用偏好</text>
            <button class="setting-row" :disabled="busy" @click="modal = 'appearance'" hover-class="pressed"
                    :hover-start-time="0" :hover-stay-time="70">
              <view>
                <text class="setting-title">外观设置</text>
                <text class="setting-description">{{ activeTheme.name }} · {{ activeTheme.english }}</text>
              </view>
              <SvgIcon name="chevron" :size="17"/>
            </button>
            <button class="setting-row" :disabled="busy" @click="toggleSaveChat" hover-class="pressed"
                    :hover-start-time="0" :hover-stay-time="70">
              <view>
                <text class="setting-title">保存完整聊天</text>
                <text class="setting-description">关闭时清除聊天和总结；长期记忆单独管理</text>
              </view>
              <view class="toggle" :class="{ on: user?.save_chat }">
                <view/>
              </view>
            </button>
          </view>
          <view class="settings-group">
            <button class="setting-row" :disabled="busy" @click="toggleAIConsent" hover-class="pressed"
                    :hover-start-time="0" :hover-stay-time="70">
              <view>
                <text class="setting-title">允许 AI 对话</text>
                <text class="setting-description">可以随时撤回同意，停止新的处理</text>
              </view>
              <view class="toggle" :class="{ on: user?.ai_consent }">
                <view/>
              </view>
            </button>
          </view>
          <view class="settings-group">
            <button class="setting-row" @click="modal = 'support'" hover-class="pressed" :hover-start-time="0"
                    :hover-stay-time="70">
              <view>
                <text class="setting-title">新会话的默认回应方式</text>
                <text class="setting-description">
                  {{ supportStyles.find(item => item.id === canonicalSupportStyle(user?.support_style))?.title }}
                </text>
              </view>
              <SvgIcon name="chevron" :size="17"/>
            </button>
          </view>
          <view class="settings-group">
            <text class="group-label">我的记录</text>
            <button class="setting-row" @click="drawer = 'memories'"><view><text class="setting-title">整理长期记忆</text><text class="setting-description">{{ user?.use_memory ? '已启用 · 可编辑、停用、合并或删除' : '尚未用于回复 · 由你确认和管理' }}</text></view><SvgIcon name="chevron" :size="17" /></button>
            <button class="setting-row" @click="showHistory" hover-class="pressed" :hover-start-time="0"
                    :hover-stay-time="70">
              <text class="setting-title">回看走过的路</text>
              <SvgIcon name="arrow-diagonal" :size="17"/>
            </button>
            <button class="setting-row" @click="modal = 'privacy'" hover-class="pressed" :hover-start-time="0"
                    :hover-stay-time="70">
              <text class="setting-title">隐私与使用说明</text>
              <SvgIcon name="arrow-diagonal" :size="17"/>
            </button>
          </view>
          <view class="usage-card">
            <text class="eyebrow">温和使用，慢慢推进</text>
            <text class="body-copy">今天已对话 {{ usage.daily_calls }} / {{ usage.daily_limit }} 次</text>
            <text class="muted small">
              {{ config.ai_mode === 'demo' ? '当前为本地演示，不产生模型费用' : '服务额度用完后，卡片和反馈仍可使用' }}
            </text>
          </view>
          <button class="secondary logout-button" :disabled="busy" @click="logOut" hover-class="gem-logout-pressed"
                  :hover-start-time="0" :hover-stay-time="70">退出登录
          </button>
          <button class="text-button danger-link" :disabled="busy" @click="deleteAccount" hover-class="pressed"
                  :hover-start-time="0" :hover-stay-time="70">删除账号与全部个人记录
          </button>
          <text class="version-label">{{ 'AGENCY BLOOM · 0.1.0\n给自己一点空间' }}</text>
        </view>
        <view v-if="tab !== 'chat'" class="tabbar journey-nav" role="navigation" aria-label="主导航">
          <button
              v-for="item in navigationItems"
              :key="item.id" :data-tab="item.id" class="nav-item"
              :class="{ active: tab === item.id, 'nav-conversation': item.id === 'chat' }"
              :aria-label="item.label" :aria-current="tab === item.id ? 'page' : undefined"
              hover-class="nav-pressed" :hover-start-time="0" :hover-stay-time="70"
              @click="selectTab(item.id as typeof tab)">
            <view class="tab-icon-frame">
              <image class="tab-glyph" :src="navImages[item.id]" mode="aspectFit"/>
            </view>
            <text class="nav-label">{{ item.label }}</text>
          </button>
        </view>
      </template>

      <view v-if="modal" class="modal-backdrop" @click.self="!busy && (modal = '')">
        <view class="modal-sheet" :class="{ 'appearance-sheet': modal === 'appearance' }" @click.stop>
          <view class="modal-handle"/>
          <view class="modal-heading">
            <text class="section-title">{{
                modal === 'edit' ? '这张卡片，由你确认' : modal === 'experiment' ? '先试一点，由你决定' : modal === 'feedback' ? '最近，有什么变化？' : modal === 'ai' ? '开始之前，先告诉你' : modal === 'appearance' ? '选择舒服的光线' : modal === 'support' ? '此刻，希望怎样被支持' : '用户协议与隐私政策'
              }}
            </text>
            <button class="icon-button" :disabled="busy" aria-label="关闭面板" @click="modal = ''" hover-class="pressed"
                    :hover-start-time="0" :hover-stay-time="70">
              <SvgIcon name="close" :size="20"/>
            </button>
          </view>
          <scroll-view scroll-y class="modal-scroll" :class="{ 'appearance-scroll': modal === 'appearance' }">
            <view v-if="error" class="notice error-notice">{{ error }}</view>
            <template v-if="modal === 'edit'">
              <text class="muted small">这些内容只有保存后才会成为下次接续的依据，列表每行一项</text>
              <text class="field-label">当前问题</text>
              <input v-model="editor.title" class="text-field" maxlength="120"/>
              <view v-for="field in editFields" :key="field.key">
                <text class="field-label">{{ field.label }}</text>
                <textarea v-model="editor[field.key]" class="text-area compact" :placeholder="field.hint"
                          maxlength="4800" :auto-height="true"/></view>
              <text class="field-label">我愿意尝试的下一步</text>
              <textarea v-model="editor.next_step" class="text-area compact" maxlength="600"/>
              <button v-if="error" class="text-button" @click="reloadVersion" hover-class="pressed"
                      :hover-start-time="0" :hover-stay-time="70">读取最新卡片版本，保留当前编辑
              </button>
              <button class="primary" :disabled="busy" :loading="busy" @click="saveEditor"
                      hover-class="pressed" :hover-start-time="0" :hover-stay-time="70">确认这些内容并保存
                <SvgIcon name="check" light :size="19"/>
              </button>
            </template>
            <template v-else-if="modal === 'experiment'">
              <text class="body-copy">这是一份可以修改的小实验草稿，确认后才会替换卡片中的下一步，其他已确认信息保持不变</text>
              <view v-for="field in experimentFields" :key="field.key"><text class="field-label">{{ field.label }}</text><textarea v-model="experimentEditor[field.key]" class="text-area compact experiment-input" :data-experiment="field.key" :maxlength="field.max" :auto-height="true" /></view>
              <text v-if="!canSaveExperiment" class="muted small">请填写四项内容，合计不超过 600 字；也可以先关闭，继续想想</text>
              <button class="primary confirm-experiment" :disabled="busy || !canSaveExperiment" :loading="busy" @click="saveExperiment" hover-class="pressed" :hover-start-time="0" :hover-stay-time="70">确认，把这个小实验留在卡片里 <SvgIcon name="check" light :size="19" /></button>
              <button class="text-button wide" :disabled="busy" @click="modal = ''">先不保存，继续探索</button>
            </template>
            <template v-else-if="modal === 'feedback'">
              <text class="page-description">新的发现、疲惫、暂时停下或改变主意，都可以留在这里</text>
              <view class="chips">
                <button
                    v-for="item in [{ id: 'progress', label: '有了进展' }, { id: 'stuck', label: '遇到阻碍' }, { id: 'change', label: '想法变了' }]"
                    :key="item.id" class="chip" :class="{ selected: feedbackKind === item.id }"
                    @click="feedbackKind = item.id" hover-class="pressed" :hover-start-time="0" :hover-stay-time="70">
                  {{ item.label }}
                </button>
              </view>
              <textarea v-model="feedbackText" class="text-area" maxlength="2000"
                        :placeholder="feedbackKind === 'change' ? '现在，你更愿意怎样选择？也可以先记下还不确定的感受' : feedbackKind === 'stuck' ? '这次体验让你有什么感受？不用急着找到解决办法' : '实际发生了什么？记下一点就好，不必是一项成果'"/>
              <button class="primary" :disabled="busy || !feedbackText.trim()" :loading="busy" @click="saveFeedback"
                      hover-class="pressed" :hover-start-time="0" :hover-stay-time="70">留下这次变化
                <SvgIcon name="check" light :size="19"/>
              </button>
            </template>
            <template v-else-if="modal === 'ai'">
              <text class="body-copy">{{
                  config.ai_mode === 'demo' ? '当前为本地演示，回复来自固定示例，不会向 DeepSeek 发送内容，启用真实 AI 后，下述处理说明适用' : '为了回应你，我们会将当前探索卡片、背景与反馈、本次输入、有限的当前会话、已审阅总结、你明确关联的探索卡片，以及已启用且范围匹配的长期记忆发送给 DeepSeek 处理。整理总结由你点击触发，也使用对话额度'
                }}
              </text>
              <text class="body-copy">AI
                的建议可能有误，尚未核实的内容会作为推测或待核实项，它不会替你做决定，也不会自动改写你的卡片
              </text>
              <text class="body-copy">产品默认不保存完整聊天；这与第三方模型服务的数据处理政策是不同的</text>
              <button class="primary" :disabled="busy" @click="consentAI" hover-class="pressed" :hover-start-time="0"
                      :hover-stay-time="70">同意并开始聊聊
                <SvgIcon name="arrow" light :size="20"/>
              </button>
              <button class="text-button wide" @click="modal = ''" hover-class="pressed" :hover-start-time="0"
                      :hover-stay-time="70">暂时不用 AI，先整理卡片
              </button>
            </template>
            <template v-else-if="modal === 'appearance'">
              <text class="page-description">换一种氛围，继续做你自己</text>
              <view class="theme-grid">
                <button v-for="theme in themes" :key="theme.id" class="theme-card" :data-theme="theme.id"
                        :aria-label="'使用' + theme.name + '主题'" :aria-pressed="activeTheme.id === theme.id"
                        :class="{ chosen: activeTheme.id === theme.id }" :disabled="busy || !!applyingTheme"
                        @click="setTheme(theme.id)" hover-class="theme-pressed" :hover-start-time="0" :hover-stay-time="70">
                  <ThemePreview :theme="theme" />
                  <view class="theme-copy" :style="{ background: theme.palette.paper, color: theme.palette.ink }">
                    <view class="theme-name-row"><text>{{ theme.name }}</text><view class="theme-swatches"><view v-for="color in [theme.palette.bg, theme.palette.soft, theme.palette.fill]" :key="color" :style="{ background: color }"/></view></view>
                    <text class="theme-english" :style="{ color: theme.palette.muted }">{{ theme.english }}{{ theme.id === 'light' ? ' · 默认' : '' }}</text>
                    <text class="theme-detail" :style="{ color: theme.palette.muted }">{{ theme.detail }}</text>
                  </view>
                  <view v-if="activeTheme.id === theme.id" class="theme-check"><SvgIcon name="check" light :size="15"/></view>
                  <view v-if="applyingTheme === theme.id" class="theme-applying">正在应用</view>
                </button>
              </view>
            </template>
            <template v-else-if="modal === 'support'">
              <button v-for="item in supportStyles" :key="item.id" class="support-setting"
                      :class="{ selected: canonicalSupportStyle(user?.support_style) === item.id }" :disabled="busy || sending"
                      @click="setSupportStyle(item.id)" hover-class="pressed" :hover-start-time="0"
                      :hover-stay-time="70">
                <text>{{ item.title }}</text>
                <text class="muted small">{{ item.detail }}</text>
              </button>
            </template>
            <template v-else>
              <text class="eyebrow">你的选择，始终重要</text>
              <text class="field-label">使用约定</text>
              <text class="body-copy">本 Alpha
                面向成年人，你保留自己的决定权，可以停止使用、修改记录或删除账号，请只提供有权分享的信息；关键行动和事实由你核实，正式发布前会补齐运营主体与联系渠道
              </text>
              <text class="field-label">回答问题时</text>
              <text class="body-copy">引导草稿保存在当前设备，可在 7
                天内接续；下次打开时会清除过期草稿，点击「保存这次探索」前不上传回答，你可以在引导页随时清除本机草稿；不要在共用设备上填写敏感信息
              </text>
              <text class="field-label">登录和保存</text>
              <text class="body-copy">
                保存探索、会话名称、你确认的决策卡和反馈。完整聊天默认不保存，开启后只保存之后的对话和你确认的会话总结；关闭会清除聊天与总结。长期记忆只有明确确认后才保存，使用开关独立，支持编辑、停用、合并和删除；删除记忆不改写历史聊天原文
              </text>
              <text class="field-label">AI 与数据服务</text>
              <text class="body-copy">AI 对话在你单独同意后调用 DeepSeek，部署版本使用 Supabase 托管
                PostgreSQL，可能在境外区域；正式内测前需确定实际部署区域并更新说明，当前本地演示使用本机 SQLite，固定示例回复不调用模型
              </text>
              <text class="field-label">关于建议</text>
              <text class="body-copy">
                这里提供理解处境、澄清选择和探索下一步的支持，不提供心理诊断或治疗，模型生成的内容可能不准确，关键事实需要核实，下一步由你决定
              </text>
              <text class="field-label">记录删除与运行日志</text>
              <text class="body-copy">
                应用不在运行日志中记录聊天正文或密钥，删除账号后，保留不含对话内容、已解除账号关联的费用统计，第三方服务的留存规则以其实际政策为准
              </text>
              <text class="muted small">{{ '内测说明 · 2026-10-16\n正式公开发布前需补齐运营主体和联系方式' }}</text>
            </template>
          </scroll-view>
          <view v-if="modal === 'appearance'" class="appearance-footer"><ActionButton :arrow="false" :disabled="busy" @click="modal = ''">完成</ActionButton></view>
        </view>
      </view>
      <ConversationDrawer v-if="drawer && user" :view="drawer" :conversations="conversations" :active="activeConversation" :issues="archives" :user="user"
                          :summary="workspace.active.value.summary.value" :summary-draft="workspace.active.value.summaryDraft.value"
                          :generating="sending" :running="runningIds" :error="chatError || error" :request="request"
                          @close="drawer = ''" @view-changed="drawer = $event" @select="selectConversation" @refresh="guarded(refreshWorkspace)"
                          @create-issue="beginAnotherExploration" @select-issue="selectExploration" @generate="generateSummary" @reviewed="reviewSummary"
                          @new-chat="startNewChat"
                          @changed="changedConversation" @deleted="deletedConversation" @user-changed="user = $event" @context-changed="workspace.cancelAll()" />
      <view v-if="toast" class="toast">{{ toast }}</view>
    </view>
  </view>
</template>
<style scoped>
.entry-status { padding:calc(var(--capsule-bottom,64px) + 80px) 32px 40px; }
.entry-status .page-title { margin:24px 0; font-size:28px; }
.entry-status .action-button { margin-top:28px; }
</style>

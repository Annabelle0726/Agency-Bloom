<script setup lang="ts">
import {computed, nextTick, onMounted, onUnmounted, reactive, ref, watch} from 'vue'
import {onHide, onReady} from '@dcloudio/uni-app'
import {makePreview, mergeSuggestion, experimentProposal} from '../../domain'
import {newOnboarding, DRAFT_KEY, supportStyles, canonicalSupportStyle} from '../../onboarding'
import OnboardingFlow from '../../components/OnboardingFlow.vue'
import FirstArrival from '../../components/FirstArrival.vue'
import { createArrivalGate } from '../../arrival'
import ActionButton from '../../components/ActionButton.vue'
import EmptyState from '../../components/EmptyState.vue'
import SvgIcon from '../../components/SvgIcon.vue'
import CompanionAvatar from '../../components/CompanionAvatar.vue'
import {iconSources} from '../../icons'
import NightCompass from '../../components/NightCompass.vue'
import type {Card, ChatMessage, Issue, Onboarding, User, Experiment} from '../../domain'
import {ApiError, createApi} from '../../http'
import {createOperationState} from '../../operations'
import type {OperationScope} from '../../operations'
import {createChatSession} from '../../chat'
import {createAvatarStore} from '../../avatar'

const token = ref<string>(uni.getStorageSync('agency.session') || '')
const user = ref<User | null>(null)
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

async function removeAvatar() {
  const id = user.value?.id
  if (!id || avatarBusy.value) return
  await localAvatars.clear(id)
  userAvatar.value = ''
}

const current = ref<Issue | null>(null)
const config = ref({dev_auth: false, ai_mode: 'demo'})
const ready = ref(false)
const screen = ref<'onboard' | 'arrival' | 'space'>('onboard')
const arrivalGate = createArrivalGate({
  read: key => uni.getStorageSync(key),
  write: (key, value) => uni.setStorageSync(key, value),
  remove: key => uni.removeStorageSync(key),
})
function enterSpace() {
  if (user.value) arrivalGate.complete(user.value.id)
  screen.value = 'space'
  tab.value = 'now'
  void nextTick(() => uni.pageScrollTo({ scrollTop: 0, duration: 0 }))
}
const keyboardHeight = ref(0)
const composerHeight = ref(62)
async function measureComposer() {
  await nextTick()
  uni.createSelectorQuery().select('.composer').boundingClientRect(rect => {
    if (rect && !Array.isArray(rect) && typeof rect.height === 'number' && rect.height > 0) composerHeight.value = rect.height
  }).exec()
}
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
const tab = ref<'now' | 'chat' | 'settings'>('now')
const modal = ref<'' | 'privacy' | 'edit' | 'feedback' | 'ai' | 'history' | 'appearance' | 'support' | 'experiment'>('')
const operations = createOperationState()
const busy = computed(() => operations.busy.auth || operations.busy.data)
const error = computed({ get: () => operations.errors.data, set: value => { operations.errors.data = value } })
const authError = computed(() => operations.errors.auth)
const chatError = computed(() => operations.errors.ai)
const offline = computed(() => !!operations.errors.init)
const toast = ref('')
const form = reactive<Onboarding>(newOnboarding())
const preview = computed(() => makePreview(form))
const dark = computed(() => screen.value === 'space' && !!user.value && user.value.theme === 'dark')

// #ifdef MP-WEIXIN
function syncStatusBar() {
  uni.setNavigationBarColor({
    frontColor: dark.value ? '#ffffff' : '#000000',
    backgroundColor: dark.value ? '#111827' : '#F6F5F2',
  })
}

onReady(syncStatusBar)
watch(dark, syncStatusBar)
// #endif
const card = computed(() => current.value?.card ?? preview.value)
const conversation = createChatSession({
  post: (issueId, body) => api.request('POST', `/issues/${issueId}/chat`, body),
  cancelRemote: id => request('POST', `/requests/${id}/cancel`),
  requestId,
  onError: message => {
    operations.errors.ai = message
  },
  onCancelled: message => notify(message),
})
const {messages, draft, pendingText, sending, suggestion, insight, insightReaction} = conversation
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
const selectedMode = computed(() => canonicalSupportStyle(user.value?.support_style))
const welcomeContext = computed(() => current.value?.focus_response || current.value?.actual_question || current.value?.background || '')

function reactToInsight(action: 'interested' | 'dismissed' | 'experiment') {
  if (busy.value || sending.value || !insight.value || !current.value) return
  const experiment = conversation.reactToInsight(action)
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
  conversation.reset()
  token.value = '';
  user.value = null;
  current.value = null;
  messages.value = [];
  suggestion.value = null
  draft.value = '';
  pendingText.value = '';
  archives.value = []
  Object.assign(form, newOnboarding())
  screen.value = 'onboard';
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
      if (scope === 'auth' && err instanceof ApiError && (['network', 'timeout'].includes(err.kind) || err.status >= 500)) throw Error('暂时无法连接服务，你可以继续浏览，连接恢复后再保存')
      throw err
    }
  })
}

async function loadCurrent() {
  const next = await request<Issue | null>('GET', '/issues/current')
  if (next?.id !== current.value?.id) conversation.reset()
  current.value = next
  if (current.value) {
    screen.value = user.value ? arrivalGate.restore(user.value.id) : 'space'
    messages.value = await request<ChatMessage[]>('GET', `/issues/${current.value.id}/messages`)
  } else {
    screen.value = 'onboard'
  }
}

async function initialize() {
  await guarded(async () => {
    config.value = await request('GET', '/config')
  }, 'init')
  ready.value = true
  if (token.value && !offline.value) await guarded(async () => {
    user.value = await request<User>('GET', '/me')
    await loadCurrent()
  })
}

onMounted(initialize)
onHide(() => {
  if (sending.value) cancelChat()
})

async function saveInitial() {
  current.value = await request<Issue>('POST', '/issues', form)
  if (user.value && form.support_style) user.value.support_style = form.support_style
  conversation.reset()
  screen.value = user.value ? arrivalGate.afterSave(user.value.id) : 'space'
  tab.value = 'now'
  uni.removeStorageSync(DRAFT_KEY)
  if (screen.value === 'space') notify('这件事，已经为你留下了')
  else toast.value = ''
  void nextTick(() => uni.pageScrollTo({ scrollTop: 0, duration: 0 }))
}

async function authenticateForm(draftForm: Onboarding, dev = false) {
  Object.assign(form, draftForm)
  if (user.value) {
    await guarded(saveInitial, 'auth');
    return
  }
  await guarded(async () => {
    if (offline.value || !ready.value) {
      config.value = await request('GET', '/config')
      operations.clear('init'); ready.value = true
    }
    let path = '/auth/dev'
    const body: { privacy_accepted: true; code?: string } = {privacy_accepted: true}
    if (!dev) {
      path = '/auth/wechat'
      const login = await new Promise<UniApp.LoginRes>((resolve, reject) => uni.login({
        provider: 'weixin',
        success: resolve,
        fail: reject
      }))
      body.code = login.code
    }
    const result = await request<{ token: string; user: User }>('POST', path, body)
    token.value = result.token;
    user.value = result.user;
    uni.setStorageSync('agency.session', result.token)
    const existing = await request<Issue | null>('GET', '/issues/current')
    if (existing) {
      await loadCurrent();
      uni.removeStorageSync(DRAFT_KEY);
      notify('欢迎回来，接着上次的进展')
    } else if (form.exploration_intent || form.concerns.length || form.title.trim()) await saveInitial()
    else {
      screen.value = 'onboard'
    }
  }, 'auth')
}

async function selectTab(nextTab: typeof tab.value) {
  if (tab.value === nextTab) return
  error.value = '';
  tab.value = nextTab
  await nextTick()
  uni.pageScrollTo({scrollTop: 0, duration: 0})
  if (nextTab === 'settings') await guarded(async () => {
    usage.value = await request('GET', '/usage')
  })
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
    current.value = await request('GET', '/issues/current');
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
    notify('新的进展，已经记下')
  })
}

function requestId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.floor(Math.random() * 16)
    return (c === 'x' ? r : (r & 3) | 8).toString(16)
  })
}

async function sendChat() {
  if (sending.value || !draft.value.trim() || !current.value) return
  if (!user.value?.ai_consent) {
    modal.value = 'ai';
    return
  }
  operations.clear('ai')
  await conversation.send(current.value.id)
}

function cancelChat() {
  conversation.cancel()
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
  if (!save && !await confirm('关闭聊天保存', '已保存的完整聊天记录也会被清除，决策卡和反馈会保留')) return
  await guarded(async () => {
    user.value = await request('PUT', '/me', {save_chat: save});
    notify(save ? '之后的聊天会保存到你的账号' : '已关闭，并清除已保存的聊天记录')
  })
}

async function setTheme(theme: 'light' | 'dark') {
  await guarded(async () => {
    user.value = await request('PUT', '/me', {theme})
  })
}

async function setSupportStyle(support_style: string) {
  await guarded(async () => {
    user.value = await request('PUT', '/me', {support_style});
    modal.value = '';
    notify('已保存你此刻希望获得的支持')
  })
}

async function toggleAIConsent() {
  if (!user.value?.ai_consent) {
    modal.value = 'ai';
    return
  }
  if (sending.value) cancelChat()
  await guarded(async () => {
    user.value = await request('PUT', '/me', {ai_consent: false})
    suggestion.value = null
    insight.value = null
    notify('已关闭 AI 对话；卡片和反馈仍可使用')
  })
}

async function endIssue() {
  if (!current.value || !await confirm('结束这件事', '已经确认的卡片与进展会留在历史里，之后可以开始一个新问题')) return
  await guarded(async () => {
    await request('POST', `/issues/${current.value!.id}/end`)
    conversation.reset();
    current.value = null
    Object.assign(form, newOnboarding())
    screen.value = 'onboard'
  })
}

async function showHistory() {
  await guarded(async () => {
    archives.value = await request('GET', '/issues');
    modal.value = 'history'
  })
}

async function logOut() {
  await guarded(async () => {
    await request('POST', '/auth/logout');
    clearSession()
  })
}

async function deleteAccount() {
  if (!await confirm('删除我的全部记录', '账号、卡片、反馈和已保存的聊天将被永久删除，无法撤销')) return
  await guarded(async () => {
    const id = user.value?.id;
    await request('DELETE', '/me');
    if (id) arrivalGate.forget(id)
    if (id) await localAvatars.clear(id);
    clearSession();
    notify('你的个人记录已删除')
  })
}

const prettyDate = (date: string) => new Date(date).toLocaleDateString('zh-CN', {month: 'long', day: 'numeric'})
</script>

<template>
  <view class="preview-stage"
        :class="{ dark, 'night-space': dark && screen === 'space', 'night-home': dark && screen === 'space' && tab === 'now', 'keyboard-open': keyboardHeight > 0 }"
        :style="{ '--keyboard-height': `${keyboardHeight}px`, '--status-bar-height': `${statusHeight}px`, '--capsule-bottom': `${capsuleBottom}px` }">
    <view class="app-shell"
          :class="{ 'with-tabs': screen === 'space', 'chat-page': tab === 'chat' && screen === 'space', 'onboarding-shell': screen !== 'space' }">
      <image v-if="screen === 'space' && tab === 'now' && !dark" class="home-background" src="/static/morning-light.jpg"
             mode="aspectFill"/>
      <view v-if="screen === 'space' && tab === 'now' && dark" class="night-atmosphere" aria-hidden="true">
        <image src="/static/art/night-water.jpg" mode="aspectFill"/>
      </view>
      <view v-if="screen === 'space'" class="topbar">
        <button class="icon-button" aria-label="回看历史记录" hover-class="pressed" :hover-start-time="0"
                :hover-stay-time="70" @click="showHistory">
          <SvgIcon name="menu" :size="21"/>
        </button>
        <view class="brand-lockup" aria-label="Agency OS">
          <image class="brand-lockup-symbol"
                 :src="dark ? '/static/brand-sprout-night.png' : '/static/brand-sprout.png'"
                 mode="aspectFit" />
          <text class="space-wordmark">AGENCY OS</text>
        </view>
        <button class="icon-button" aria-label="打开我的设置" hover-class="pressed" :hover-start-time="0"
                :hover-stay-time="70" @click="selectTab('settings')">
          <SvgIcon name="user" :size="21"/>
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

      <OnboardingFlow v-if="screen === 'onboard'" :busy="busy" :error="authError" :dev-auth="config.dev_auth" :offline="offline"
                      :authenticated="!!user" :ready="ready" @save="authenticateForm" @privacy="modal = 'privacy'"
                      @retry="initialize" @navigate="operations.clear('auth')"/>

      <FirstArrival v-else-if="screen === 'arrival'" @enter="enterSpace" />

      <template v-else-if="current">
        <view v-if="tab === 'now'" class="workspace">
          <view class="home-heading">
            <template v-if="dark">
              <text class="night-greeting">你好</text>
              <text class="night-welcome">欢迎来到
                <text class="night-title-accent">你的空间</text>
              </text>
              <text class="night-whisper">今晚，不急着解决一切</text>
            </template>
            <template v-else>
              <text class="page-title">{{ '你好\n欢迎来到你的空间' }}</text>
              <text class="page-description">{{ '按自己的节奏\n慢慢看清真实的自己' }}</text>
            </template>
          </view>
          <view v-if="dark" class="night-symbol">
            <NightCompass/>
          </view>
          <view class="home-focus">
            <SvgIcon v-if="!dark" name="compass" :size="21"/>
            <view class="home-focus-copy">
              <text class="eyebrow">此刻，先照顾这一件事</text>
              <text>{{ current.title || '一次还未命名的探索' }}</text>
            </view>
          </view>
          <view class="home-actions">
            <view class="home-actions-title">
              <view v-if="dark" class="entry-glint"/>
              <text class="home-actions-heading">今天，想
                <text class="home-heading-accent">从哪里开始</text>
              </text>
            </view>
            <button class="home-action" hover-class="home-action-pressed" :hover-start-time="0" :hover-stay-time="70"
                    @click="selectTab('chat')">
              <view class="home-entry-icon">
                <image class="home-entry-glyph" :src="iconSources.chat.ink" mode="aspectFit"/>
              </view>
              <view class="home-entry-copy">
                <text>继续我们刚才的话题</text>
                <text v-if="dark" class="home-entry-note">从刚才的思绪，轻轻接着说</text>
              </view>
              <view class="home-entry-arrow">
                <image class="home-entry-glyph" :src="iconSources['arrow-diagonal'].ink" mode="aspectFit"/>
              </view>
            </button>
            <button class="home-action" hover-class="home-action-pressed" :hover-start-time="0" :hover-stay-time="70"
                    @click="modal = 'feedback'">
              <view class="home-entry-icon">
                <image class="home-entry-glyph" :src="iconSources.note.ink" mode="aspectFit"/>
              </view>
              <view class="home-entry-copy">
                <text>记录此刻的想法</text>
                <text v-if="dark" class="home-entry-note">把一点新的发现，留在这里</text>
              </view>
              <view class="home-entry-arrow">
                <image class="home-entry-glyph" :src="iconSources['arrow-diagonal'].ink" mode="aspectFit"/>
              </view>
            </button>
            <button class="home-action" hover-class="home-action-pressed" :hover-start-time="0" :hover-stay-time="70"
                    @click="card.next_step ? openEditor() : selectTab('chat')">
              <view class="home-entry-icon">
                <image class="home-entry-glyph" :src="iconSources.step.ink" mode="aspectFit"/>
              </view>
              <view class="home-entry-copy">
                <text>看看接下来可以做什么</text>
                <text v-if="dark" class="home-entry-note">不求很多，先走一小步</text>
              </view>
              <view class="home-entry-arrow">
                <image class="home-entry-glyph" :src="iconSources['arrow-diagonal'].ink" mode="aspectFit"/>
              </view>
            </button>
          </view>
          <view v-if="card.next_step" class="next-card">
            <text class="eyebrow">我愿意尝试的下一步</text>
            <text class="next-title">{{ card.next_step }}</text>
            <button class="text-button" @click="modal = 'feedback'" hover-class="pressed" :hover-start-time="0"
                    :hover-stay-time="70">记下新的进展
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
          <button class="text-button end-link" @click="endIssue" hover-class="pressed" :hover-start-time="0"
                  :hover-stay-time="70">结束这件事，给新的方向留空间
          </button>
        </view>

        <view v-else-if="tab === 'chat'" class="chat-content" :style="{ '--composer-height': `${composerHeight}px` }">
          <text class="eyebrow">LET'S THINK TOGETHER</text>
          <text class="chat-title">一起，把它理清</text>
          <view v-if="chatError" class="notice chat-error"><text>{{ chatError }}</text><button class="notice-close" aria-label="关闭对话提示" @click="operations.clear('ai')"><SvgIcon name="close" :size="18" /></button></view>
          <text v-if="config.ai_mode === 'demo'" class="demo-chat-note">本地演示 · 以下回复为固定示例，不调用模型</text>
          <view class="context-pill">
            <view class="live-dot"/>
            <text>{{ current.title || '一次还未命名的探索' }}</text>
          </view>
          <scroll-view scroll-x class="chat-mode-scroll" :show-scrollbar="false"><view class="chat-modes"><button v-for="mode in supportStyles" :key="mode.id" class="mode-chip" :data-mode="mode.id" :class="{ selected: selectedMode === mode.id }" :disabled="busy || sending" :aria-pressed="selectedMode === mode.id" @click="setSupportStyle(mode.id)" hover-class="pressed" :hover-start-time="0" :hover-stay-time="70">{{ mode.title }}</button></view></scroll-view>
          <view v-if="!messages.length" class="chat-welcome">
            <image class="welcome-avatar" src="/static/avatar-agency.png" mode="aspectFit" aria-label="Agency OS 头像"/>
            <text class="body-copy">{{ welcomeContext ? '你刚才留下的线索已带到这里，不必重新填写' : '你不需要一次说清楚，想到什么，就从哪里说起' }}</text>
            <text v-if="welcomeContext" class="welcome-context">{{ welcomeContext }}</text>
            <view class="prompt-list">
              <button v-for="prompt in [welcomeContext ? '从我刚才留下的线索开始探索' : '先从一次真实经历开始', '看看我的经历还能连接到什么', '我想试一点，但不想冒太大风险']"
                      :key="prompt" class="prompt-button" @click="draft = prompt" hover-class="pressed"
                      :hover-start-time="0" :hover-stay-time="70">{{ prompt }}
                <SvgIcon name="arrow-diagonal" :size="17"/>
              </button>
            </view>
          </view>
          <view v-for="(message, index) in messages" :id="'message-' + index" :key="index" class="message-row" :class="message.role">
            <CompanionAvatar v-if="message.role === 'assistant'" :size="38"
                             :state="speakingIndex === index ? 'speaking' : (index === messages.length - 1 ? 'idle' : 'rest')" />
            <image v-else class="chat-avatar"
                   :src="userAvatar || '/static/avatar-user.png'"
                   mode="aspectFill" aria-label="你的头像"/>
            <view class="message-content">
              <text v-if="message.role === 'assistant'" class="message-name">AGENCY OS</text>
              <text class="message-bubble">{{ message.content }}</text>
            </view>
          </view>
          <view v-if="sending" class="message-row user">
            <image class="chat-avatar" :src="userAvatar || '/static/avatar-user.png'" mode="aspectFill"
                   aria-label="你的头像"/>
            <view class="message-content">
              <text class="message-bubble">{{ pendingText }}</text>
            </view>
          </view>
          <view v-if="sending" class="thinking">
            <CompanionAvatar :size="38" state="thinking" :interactive="false"/>
            <view class="thinking-copy">
              <text class="message-name">AGENCY OS</text>
              <text>正在回应，随时可以停止</text>
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
          <text class="chat-disclosure">
            {{ user?.save_chat ? '已开启聊天保存，可在「我的」中关闭并清除' : '完整聊天默认不保存 · 确认的卡片会留下' }}
          </text>
          <view class="composer"><textarea v-model="draft" class="chat-input" :adjust-position="false" @linechange="measureComposer"
                                           :cursor-spacing="24" :disabled="sending" maxlength="2000" :auto-height="true"
                                           placeholder="想到什么，就从哪里说起……"/>
            <button class="send-button" :disabled="!sending && !draft.trim()"
                    :aria-label="sending ? '停止回复' : '发送消息'" @click="sending ? cancelChat() : sendChat()"
                    hover-class="pressed" :hover-start-time="0" :hover-stay-time="70">
              <SvgIcon :name="sending ? 'stop' : 'arrow-up'" light :size="21"/>
            </button>
          </view>
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
                    @chooseavatar="chooseAvatar" hover-class="pressed" :hover-start-time="0" :hover-stay-time="70">
              {{ avatarBusy ? '正在保存' : '选择微信头像' }}
            </button>
            <!-- #endif -->
            <button v-if="userAvatar" class="text-button" @click="removeAvatar">恢复默认头像</button>
          </view>
          <view class="settings-group">
            <text class="group-label">使用偏好</text>
            <button class="setting-row" :disabled="busy" @click="modal = 'appearance'" hover-class="pressed"
                    :hover-start-time="0" :hover-stay-time="70">
              <view>
                <text class="setting-title">外观设置</text>
                <text class="setting-description">{{ dark ? '深夜 · Quiet Night' : '晨雾 · Morning Mist' }}</text>
              </view>
              <SvgIcon name="chevron" :size="17"/>
            </button>
            <button class="setting-row" :disabled="busy" @click="toggleSaveChat" hover-class="pressed"
                    :hover-start-time="0" :hover-stay-time="70">
              <view>
                <text class="setting-title">保存完整聊天</text>
                <text class="setting-description">关闭时也会清除已保存的聊天</text>
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
                <text class="setting-title">此刻希望获得的帮助</text>
                <text class="setting-description">
                  {{ supportStyles.find(item => item.id === selectedMode)?.title }}
                </text>
              </view>
              <SvgIcon name="chevron" :size="17"/>
            </button>
          </view>
          <view class="settings-group">
            <text class="group-label">我的记录</text>
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
          <button class="secondary" :disabled="busy" @click="logOut" hover-class="pressed" :hover-start-time="0"
                  :hover-stay-time="70">退出登录
          </button>
          <button class="text-button danger-link" :disabled="busy" @click="deleteAccount" hover-class="pressed"
                  :hover-start-time="0" :hover-stay-time="70">删除账号与全部个人记录
          </button>
          <text class="version-label">{{ 'AGENCY OS · 0.1.0\n给自己一点空间' }}</text>
        </view>
        <view class="tabbar">
          <button
              v-for="item in [{ id: 'now', label: '首页', icon: 'home' }, { id: 'chat', label: '对话', icon: 'chat' }, { id: 'settings', label: '我的', icon: 'user' }]"
              :key="item.id" :data-tab="item.id" :class="{ active: tab === item.id }" hover-class="pressed"
              :hover-start-time="0" :hover-stay-time="70" @click="selectTab(item.id as typeof tab)">
            <view class="tab-icon-frame">
              <image class="tab-glyph" :src="iconSources[item.icon as keyof typeof iconSources].ink" mode="aspectFit"/>
            </view>
            <text>{{ item.label }}</text>
          </button>
        </view>
      </template>

      <view v-if="modal" class="modal-backdrop" @click.self="!busy && (modal = '')">
        <view class="modal-sheet">
          <view class="modal-handle"/>
          <view class="modal-heading">
            <text class="section-title">{{
                modal === 'edit' ? '这张卡片，由你确认' : modal === 'experiment' ? '先试一点，由你决定' : modal === 'feedback' ? '最近，有什么变化？' : modal === 'ai' ? '开始之前，先告诉你' : modal === 'history' ? '走过的路' : modal === 'appearance' ? '选择舒服的光线' : modal === 'support' ? '此刻，希望怎样被支持' : '用户协议与隐私政策'
              }}
            </text>
            <button class="icon-button" :disabled="busy" aria-label="关闭面板" @click="modal = ''" hover-class="pressed"
                    :hover-start-time="0" :hover-stay-time="70">
              <SvgIcon name="close" :size="20"/>
            </button>
          </view>
          <scroll-view scroll-y class="modal-scroll">
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
              <text class="page-description">做到了、卡住了，或者改变主意了，都值得记下</text>
              <view class="chips">
                <button
                    v-for="item in [{ id: 'progress', label: '有了进展' }, { id: 'stuck', label: '遇到阻碍' }, { id: 'change', label: '想法变了' }]"
                    :key="item.id" class="chip" :class="{ selected: feedbackKind === item.id }"
                    @click="feedbackKind = item.id" hover-class="pressed" :hover-start-time="0" :hover-stay-time="70">
                  {{ item.label }}
                </button>
              </view>
              <textarea v-model="feedbackText" class="text-area" maxlength="2000"
                        placeholder="发生了什么？你有哪些新的发现？"/>
              <button class="primary" :disabled="busy || !feedbackText.trim()" :loading="busy" @click="saveFeedback"
                      hover-class="pressed" :hover-start-time="0" :hover-stay-time="70">留下这次变化
                <SvgIcon name="check" light :size="19"/>
              </button>
            </template>
            <template v-else-if="modal === 'ai'">
              <text class="body-copy">{{
                  config.ai_mode === 'demo' ? '当前为本地演示，回复来自固定示例，不会向 DeepSeek 发送内容，启用真实 AI 后，下述处理说明适用' : '为了回应你，我们会将当前决策卡、你选择的困扰与生活背景、支持偏好、最近的反馈、本次输入和有限的会话上下文发送给 DeepSeek 处理'
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
            <template v-else-if="modal === 'history'">
              <text v-if="!archives.length" class="muted">还没有记录</text>
              <view v-for="entry in archives" :key="entry.id" class="archive-card">
                <text class="muted small">{{ prettyDate(entry.updated_at) }} · {{
                    entry.ended_at ? '已结束' : '正在跟进'
                  }}
                </text>
                <text class="card-title">{{ entry.title || '一次还未命名的探索' }}</text>
                <text class="body-copy">{{ entry.card.next_step || '还在探索方向' }}</text>
                <text v-for="line in entry.card.confirmed" :key="line" class="card-line">{{ line }}</text>
              </view>
            </template>
            <template v-else-if="modal === 'appearance'">
              <text class="page-description">换一种氛围，继续做你自己</text>
              <view class="theme-grid">
                <button class="theme-card" data-theme="light" aria-label="使用晨雾主题" :class="{ chosen: !dark }"
                        :disabled="busy" @click="setTheme('light')" hover-class="pressed" :hover-start-time="0"
                        :hover-stay-time="70">
                  <image src="/static/mountain-lake.jpg" mode="aspectFill"/>
                  <view>
                    <text>晨雾</text>
                    <text class="muted small">Morning Mist · 默认</text>
                  </view>
                  <view v-if="!dark" class="theme-check">
                    <SvgIcon name="check" light :size="15"/>
                  </view>
                </button>
                <button class="theme-card night-theme" :class="{ chosen: dark }" :disabled="busy"
                        @click="setTheme('dark')" hover-class="pressed" :hover-start-time="0" :hover-stay-time="70">
                  <image src="/static/mountain-lake.jpg" mode="aspectFill"/>
                  <view>
                    <text>深夜</text>
                    <text class="muted small">Quiet Night</text>
                  </view>
                  <view v-if="dark" class="theme-check">
                    <SvgIcon name="check" light :size="15"/>
                  </view>
                </button>
              </view>
              <text class="theme-planned">晨曦、森林、薰衣草、极简 · 计划中</text>
              <ActionButton :arrow="false" @click="modal = ''">完成</ActionButton>
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
              <text class="field-label">登录前</text>
              <text class="body-copy">引导草稿保存在当前设备，可在 7
                天内接续；下次打开时会清除过期草稿，登录并保存前不上传回答，你可以在引导页随时清除本机草稿；不要在共用设备上填写敏感信息
              </text>
              <text class="field-label">登录和保存</text>
              <text class="body-copy">
                保存当前问题、你确认的决策卡和反馈，完整聊天默认不保存，开启后只保存之后的对话；关闭会清除已保存的完整聊天，你可以修改记录，也可以删除账号与个人数据
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
        </view>
      </view>
      <view v-if="toast" class="toast">{{ toast }}</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, nextTick, onUnmounted, reactive, ref, watch } from 'vue'
import type { Onboarding } from '../domain'
import { startingConcernOptions, focusChoicesFor, concernOptions, lifeContexts, supportStyles, newOnboarding, toggleConcern, reflectionFor, reflectionHeading, saveDraft, restoreDraft, DRAFT_KEY, branchFor, selectMainline, canonicalSupportStyle, loginSummaryFor } from '../onboarding'
import ActionButton from './ActionButton.vue'
import SelectionCard from './SelectionCard.vue'
import ProgressIndicator from './ProgressIndicator.vue'
import SvgIcon from './SvgIcon.vue'
import WelcomeOpening from './WelcomeOpening.vue'

const props = defineProps<{ busy: boolean; error: string; devAuth: boolean; authenticated: boolean; ready: boolean; offline?: boolean; connecting?: boolean; wechatAuth?: boolean }>()
const emit = defineEmits<{ save: [form: Onboarding, dev: boolean]; privacy: []; retry: []; navigate: [] }>()
let cached: ReturnType<typeof restoreDraft> = null
try {
  const stored = uni.getStorageSync(DRAFT_KEY)
  cached = restoreDraft(stored)
  if (stored && !cached) uni.removeStorageSync(DRAFT_KEY)
} catch { /* Storage can be unavailable. */ }
const form = reactive({ ...newOnboarding(), ...cached?.form })
if (!form.exploration_intent && form.concerns.length === 1) form.exploration_intent = form.concerns[0]
const storyKey = 'agency.opening.story.v1'
let storySeen = props.authenticated
try { storySeen = storySeen || !!uni.getStorageSync(storyKey) } catch { /* Optional presentation state. */ }
const step = ref(cached?.step ?? (storySeen ? 0 : -1))
const accepted = ref(false)
const otherOpen = ref(!!form.actual_question)
const responseOpen = ref(!!form.title || (!!form.focus_response && !focusChoicesFor(form).includes(form.focus_response)))
const detailsOpen = ref(!!form.background || form.constraints.length > 0)
const focusChoices = computed(() => focusChoicesFor(form))
const introduction = ref(false)
const draftInfo = ref(false)
const localError = ref('')
const draftSaved = ref(!!cached)
const moving = ref(false)
const direction = ref('forward')
const scrollTop = ref(0)
let lastScrollTop = 0
let navigationTimer: ReturnType<typeof setTimeout> | undefined
const selected = computed(() => [...concernOptions, { id: 'relationships', title: '之前留下的人际关系困扰' }, { id: 'overload', title: '之前留下的生活与精力困扰' }].filter(item => form.concerns.includes(item.id)))
const reflection = computed(() => reflectionFor(form))
const reflectionTitle = computed(() => reflectionHeading(form))
const contextLabels = computed(() => lifeContexts.filter(item => form.life_contexts?.includes(item.id)))
const support = computed(() => form.support_style ? supportStyles.find(item => item.id === canonicalSupportStyle(form.support_style)) : undefined)
const branch = computed(() => branchFor(form))
const loginSummary = computed(() => loginSummaryFor(form))
// Recheck stale startup failures on entry; local onboarding still never waits for it
watch(step, value => { if (value === 5 && props.offline && !props.connecting) emit('retry') }, { immediate: true })
const constraintsText = computed({ get: () => form.constraints.join('\n'), set: value => { form.constraints = value.split('\n').map(v => v.trim()).filter(Boolean).slice(0, 12) } })
const canContinue = computed(() => step.value === 0 ? form.concerns.length > 0 : step.value === 1 ? !!form.exploration_intent : step.value === 3 ? !!form.support_style : true)
const headings = [
  { label: 'LET’S BEGIN', title: '最近，有什么让你\n感到焦虑、害怕或不安？', detail: '可以多选，也可以只是带着好奇来看看，不用写长段文字' },
  { label: 'A FIRST THREAD', title: '我们先从\n一件小事聊起', detail: '点选就好，暂时没有答案也可以继续' },
  { label: 'ABOUT YOU', title: '此刻的生活\n主要围绕什么展开', detail: '点选与你有关的词，也可以直接跳过' },
  { label: 'YOUR STYLE', title: '此刻，你希望\n得到怎样的帮助', detail: '按自己的节奏来，以后也可以改变' },
  { label: 'A BEGINNING', title: '这是一次探索的起点\n而不是对你的定义', detail: '根据固定问题整理，还没有使用 AI' },
]
const heading = computed(() => headings[step.value] || headings[0])

function persist() {
  try {
    const draft = saveDraft(form, step.value)
    uni.setStorageSync(DRAFT_KEY, draft)
    if (JSON.stringify(uni.getStorageSync(DRAFT_KEY)) !== JSON.stringify(draft)) throw Error('Local write not confirmed')
    draftSaved.value = true; localError.value = ''
  } catch { draftSaved.value = false; localError.value = '本机暂时无法保存草稿，请先不要关闭页面' }
}
watch([form, step], persist, { deep: true, flush: 'sync' })
function go(value: number) {
  if (moving.value || props.busy || value === step.value) return
  if (step.value === -1 && value === 0) {
    try { uni.setStorageSync(storyKey, true) } catch { /* Never block exploration. */ }
  }
  emit('navigate')
  direction.value = value < step.value ? 'backward' : 'forward'
  moving.value = true
  scrollTop.value = lastScrollTop
  step.value = value
  void nextTick(() => { scrollTop.value = 0; lastScrollTop = 0 })
  uni.pageScrollTo({ scrollTop: 0, duration: 0 })
  // Lock only the short transition, so a second tap cannot skip the next step
  navigationTimer = setTimeout(() => { moving.value = false }, 180)
}
onUnmounted(() => clearTimeout(navigationTimer))
function rememberScroll(event: { detail: { scrollTop: number } }) {
  // Do not send scroll position back through the Mini Program bridge on every frame
  lastScrollTop = event.detail.scrollTop
}
function choose(id: string) {
  const wasQuickAnswer = focusChoices.value.includes(form.focus_response || '')
  form.concerns = toggleConcern(form.concerns, id)
  if (!form.concerns.includes(form.exploration_intent || '')) {
    if (wasQuickAnswer) form.focus_response = ''
    form.exploration_intent = form.concerns.length === 1 ? form.concerns[0] : ''
  }
}
function focus(intent: string) {
  selectMainline(form, intent)
  responseOpen.value = !!form.title || (!!form.focus_response && !focusChoices.value.includes(form.focus_response))
}
function chooseFocus(answer: string) {
  if (moving.value || props.busy) return
  form.focus_response = form.focus_response === answer ? '' : answer
}
function context(id: string) {
  const values = form.life_contexts || []
  form.life_contexts = values.includes(id) ? values.filter(item => item !== id) : [...values, id]
}
function submit(dev: boolean) {
  if (props.busy || (!props.authenticated && !accepted.value)) return
  emit('save', JSON.parse(JSON.stringify(form)), dev)
}
function reflectionAction() { if (props.authenticated) submit(false); else go(5) }
function skipContext() { if (moving.value) return; form.life_contexts = []; go(3) }
function clearDraft() {
  clearTimeout(navigationTimer)
  moving.value = false
  Object.assign(form, newOnboarding())
  accepted.value = false
  otherOpen.value = false
  responseOpen.value = false
  detailsOpen.value = false
  draftInfo.value = false
  step.value = -1
  try { uni.removeStorageSync(DRAFT_KEY) } catch { /* Reset still works in memory */ }
}
defineExpose({ clearDraft })
</script>

<template>
  <view class="onboarding-flow" :class="{ 'welcome-scene': step === -1, 'login-scene': step === 5, 'guest-scene': step === 6 }">
    <image v-if="step === 5 || step === 6" class="scene-image wall-image" src="/static/morning-light.jpg" mode="aspectFill" />

    <WelcomeOpening v-if="step === -1" key="welcome" @start="go(0)" @about="introduction = true" />

    <view v-else-if="step < 5" key="flow-shell" class="flow-page">
      <view class="flow-chrome">
        <view class="flow-nav"><button class="icon-button flow-back" aria-label="返回上一步" :disabled="busy || moving" hover-class="pressed" :hover-start-time="0" @click="go(step - 1)"><SvgIcon name="back" :size="22" /></button><text class="flow-wordmark">YOUR SPACE</text><button class="icon-button" aria-label="草稿与隐私" hover-class="pressed" :hover-start-time="0" @click="draftInfo = true"><SvgIcon name="more" :size="22" /></button></view>
        <ProgressIndicator :current="step + 1" :total="5" />
      </view>
      <scroll-view class="flow-scroll" scroll-y :scroll-top="scrollTop" :show-scrollbar="false" @scroll="rememberScroll">
        <view :key="'content-' + step" class="flow-body" :class="'flow-' + direction + '-' + (step % 2)">
          <view class="flow-heading"><text class="eyebrow">{{ heading.label }}</text><text class="flow-title">{{ heading.title }}</text><text class="flow-description">{{ heading.detail }}</text></view>
          <view v-if="step === 0" class="selection-stack">
            <SelectionCard v-for="item in startingConcernOptions" :key="item.id" :title="item.title" :detail="item.detail" :icon="item.icon" :selected="form.concerns.includes(item.id)" @select="choose(item.id)" />
            <view v-if="form.concerns.includes('other') || form.actual_question" class="optional-writing">
              <button class="optional-toggle" :aria-expanded="otherOpen" @click="otherOpen = !otherOpen" hover-class="pressed">{{ otherOpen ? '收起补充' : '我想补充一句（选填）' }}</button>
              <textarea v-if="otherOpen" v-model="form.actual_question" class="text-area flow-textarea" maxlength="400" placeholder="一句话就好，也可以不写" :auto-height="true" />
            </view>
          </view>
          <view v-else-if="step === 1" class="selection-stack">
            <template v-if="selected.length > 1">
              <text class="field-label">先聊哪一个方向？</text>
              <SelectionCard v-for="item in selected" :key="item.id" :title="item.title" radio :selected="form.exploration_intent === item.id" @select="focus(item.id)" />
            </template>
            <view v-if="form.exploration_intent" class="exploration-branch">
              <text class="branch-question">{{ branch.question }}</text>
              <text class="flow-description">选一个接近的，也可以不选</text>
              <view class="quick-answers">
                <button v-for="answer in focusChoices" :key="answer" class="quick-answer" :class="{ chosen: form.focus_response === answer }"
                  :aria-pressed="form.focus_response === answer" @click="chooseFocus(answer)" hover-class="pressed" :hover-start-time="0">{{ answer }}</button>
              </view>
              <button class="optional-toggle" :aria-expanded="responseOpen" @click="responseOpen = !responseOpen" hover-class="pressed">{{ responseOpen ? '收起补充' : '我想用自己的话说（选填）' }}</button>
              <view v-if="responseOpen">
                <textarea v-model="form.focus_response" class="text-area flow-textarea branch-response" maxlength="800" :placeholder="branch.placeholder" :auto-height="true" />
                <text class="field-label">为这次探索起个名字，选填</text>
                <input v-model="form.title" class="text-field exploration-title" maxlength="120" placeholder="可以以后再起名字" />
              </view>
              <text class="optional-note">不选也不写，点「继续」就好</text>
            </view>
          </view>
          <view v-else-if="step === 2">
            <view class="life-contexts"><button v-for="item in lifeContexts" :key="item.id" class="context-chip" :class="{ chosen: form.life_contexts?.includes(item.id) }" :aria-pressed="form.life_contexts?.includes(item.id)" hover-class="pressed" :hover-start-time="0" :hover-stay-time="70" @click="context(item.id)">{{ item.title }}</button></view>
            <button class="optional-toggle" :aria-expanded="detailsOpen" @click="detailsOpen = !detailsOpen" hover-class="pressed">{{ detailsOpen ? '收起补充' : '有一点经历或现实条件想补充（选填）' }}</button>
            <view v-if="detailsOpen">
              <text class="field-label">愿意补充的经历，选填</text><textarea v-model="form.background" class="text-area flow-textarea" maxlength="400" placeholder="一句话、一件小事就够了" :auto-height="true" />
              <text class="field-label">想照顾到的现实条件，选填</text><textarea v-model="constraintsText" class="text-area flow-textarea" maxlength="1200" placeholder="比如时间、收入或精力，也可以以后聊" :auto-height="true" />
            </view>
          </view>
          <view v-else-if="step === 3" class="selection-stack"><SelectionCard v-for="item in supportStyles" :key="item.id" :title="item.title" :detail="item.detail" :icon="item.icon" :selected="!!form.support_style && canonicalSupportStyle(form.support_style) === item.id" @select="form.support_style = item.id" /></view>
          <view v-else class="reflection-summary">
            <view class="reflection-card reflection-record"><view class="reflection-mark"><SvgIcon name="compass" :size="24" /><text>你留下的线索，由你解释</text></view>
              <view v-if="selected.length" class="reflection-context"><text class="muted">这次想关注的方向</text><view class="chips"><text v-for="item in selected" :key="item.id" class="tag">{{ item.title }}</text></view></view>
              <view v-if="form.title" class="reflection-context"><text class="muted">你为这次探索起的名字</text><text class="reflection-copy">{{ form.title }}</text></view>
              <view v-if="form.actual_question" class="reflection-context"><text class="muted">你想探索的问题</text><text class="reflection-copy">{{ form.actual_question }}</text></view>
              <view v-if="form.focus_response && form.focus_response !== form.actual_question" class="reflection-context"><text class="muted">关于当前主线，你补充的</text><text class="reflection-copy">{{ form.focus_response }}</text></view>
              <view v-if="form.background && form.background !== form.focus_response && form.background !== form.actual_question" class="reflection-context"><text class="muted">你填写的经历</text><text class="reflection-copy">{{ form.background }}</text></view>
              <view v-if="form.constraints.length" class="reflection-context"><text class="muted">你想保留的现实条件</text><text v-for="line in form.constraints" :key="line" class="reflection-copy">{{ line }}</text></view>
              <view v-if="contextLabels.length" class="reflection-context"><text class="muted">此刻的生活背景</text><view class="chips"><text v-for="item in contextLabels" :key="item.id" class="tag">{{ item.title }}</text></view></view>
              <text v-if="!form.title && !form.actual_question && !form.focus_response && !form.background && !form.constraints.length && !contextLabels.length" class="reflection-copy reflection-empty">你选下的方向已经留下，具体经历可以以后再聊</text>
              <view v-if="support" class="reflection-support"><SvgIcon :name="support.icon" :size="19" /><text>{{ support.title }}</text></view>
            </view>
            <view class="reflection-next"><text class="eyebrow">接下来，可以怎样探索</text><text class="reflection-title">{{ reflectionTitle }}</text><text class="reflection-copy">{{ reflection }}</text><text class="reflection-note">固定问题整理 · 还没有进行 AI 分析</text></view>
          </view>
        </view>
      </scroll-view>
      <view class="flow-footer">
        <view v-if="localError || (authenticated && step === 4 && error)" class="notice">{{ localError || error }}</view>
        <ActionButton v-if="step < 4" :disabled="!canContinue" :locked="moving" @click="go(step + 1)">继续</ActionButton>
        <ActionButton v-else :loading="busy" :locked="moving" @click="reflectionAction">保存这次探索</ActionButton>
        <view class="flow-footer-detail"><button v-if="step === 2" class="flow-skip" :disabled="moving" @click="skipContext" hover-class="pressed" :hover-start-time="0" :hover-stay-time="70">暂时跳过</button><button v-else-if="step === 4 && !authenticated" class="flow-skip" :disabled="moving" @click="go(6)" hover-class="pressed" :hover-start-time="0" :hover-stay-time="70">暂时不注册</button><button v-else class="draft-link" @click="draftInfo = true" hover-class="pressed" :hover-start-time="0" :hover-stay-time="70"><SvgIcon name="lock" :size="12" /><text>{{ draftSaved ? '草稿已留在这台设备' : '匿名回答不上传' }}</text></button></view>
      </view>
    </view>

    <view v-else-if="step === 5" key="login" class="login-content">
      <button class="login-back" hover-class="pressed" :disabled="moving" @click="go(4)"><SvgIcon name="back" :size="19" /><text>返回整理</text></button>
      <view class="login-heading"><text class="eyebrow">KEEP YOUR EXPLORATION</text><text class="flow-title">{{ '把这次探索留在这里\n下次回来继续' }}</text><text class="flow-description">留住此刻的线索与好奇，下次不用重新说起</text></view>
      <view class="login-focus">
        <view class="login-focus-heading"><SvgIcon name="compass" :size="19" /><text>{{ loginSummary.name ? '你为探索起的名字' : '这次探索的起点' }}</text><text class="login-focus-index">01</text></view>
        <text class="login-focus-title">{{ loginSummary.name || loginSummary.intent || '从一点好奇开始' }}</text>
        <text v-if="loginSummary.clue" class="login-focus-clue">{{ loginSummary.clue }}</text>
        <text v-else-if="loginSummary.name && loginSummary.intent" class="login-focus-intent">{{ loginSummary.intent }}</text>
        <view class="login-focus-footer"><text v-if="loginSummary.support" class="login-support">{{ loginSummary.support }}</text><view v-if="draftSaved" class="login-draft-state"><view /><text>本机草稿已保留</text></view></view>
      </view>
      <view v-if="error || localError" class="notice">{{ error || localError }}</view>
      <view v-if="connecting || offline" class="login-connection" :class="{ 'is-reconnecting': connecting }"><view class="connection-dot" /><view class="connection-copy"><text>{{ connecting ? '正在重新连接服务' : '暂时无法连接服务' }}</text><text v-if="!connecting">可以继续浏览，连接恢复后再保存</text></view><button class="connection-retry" :disabled="connecting || busy" @click="$emit('retry')" hover-class="pressed" :hover-start-time="0" :hover-stay-time="70">{{ connecting ? '连接中' : '重试' }}</button></view>
      <view class="login-actions">
        <view class="login-consent"><button class="consent-check-target" aria-label="同意用户协议与隐私政策" :aria-pressed="accepted" @click="accepted = !accepted" hover-class="pressed" :hover-start-time="0" :hover-stay-time="70"><view class="consent-box" :class="{ checked: accepted }"><SvgIcon v-if="accepted" name="check" light :size="13" /></view></button><view class="consent-copy"><text>我已阅读并同意</text><button class="policy-link" @click="$emit('privacy')" hover-class="pressed" :hover-start-time="0" :hover-stay-time="70">《用户协议》与《隐私政策》</button></view></view>
        <text v-if="!accepted" class="consent-hint">阅读并勾选后，即可选择登录方式</text>
        <!-- #ifdef MP-WEIXIN -->
        <ActionButton kind="wechat" :disabled="!accepted || wechatAuth === false || connecting" :arrow="wechatAuth !== false" :loading="busy" @click="submit(false)">{{ wechatAuth === false ? '微信快捷登录 · 待接入' : '微信快捷登录 / 注册' }}</ActionButton>
        <text v-if="wechatAuth === false && ready && !offline" class="wechat-setup-note">{{ devAuth ? '微信登录尚未配置，内测可使用下方开发登录' : '微信登录正在准备中，你可以先继续浏览' }}</text>
        <!-- #endif -->
        <ActionButton v-if="devAuth" :disabled="!accepted || connecting" :loading="busy" @click="submit(true)">本地开发演示登录</ActionButton>
        <text v-if="devAuth" class="demo-login-note">开发登录不连接微信，AI 对话仍需另行授权</text>
        <!-- #ifdef H5 -->
        <text v-if="!devAuth && ready" class="demo-login-note">请在微信小程序中完成登录</text>
        <!-- #endif -->
        <ActionButton kind="ghost" :arrow="false" :locked="moving" @click="go(6)">暂不注册，继续看看</ActionButton>
      </view>
      <text class="login-bottom-note">你的想法，值得被认真对待</text>
    </view>

    <view v-else key="guest" class="guest-content"><text class="eyebrow">YOUR SPACE</text><text class="flow-title">{{ '你好\n这是你的探索起点' }}</text><text class="flow-description">从一点真实的好奇开始</text><view class="reflection-card"><text class="eyebrow">一次可以修改的探索</text><text class="reflection-title">{{ form.title || '先留住这一点好奇' }}</text><text v-if="form.focus_response || form.actual_question || form.background" class="guest-clue">{{ form.focus_response || form.actual_question || form.background }}</text><text class="reflection-copy">{{ form.focus_response || form.actual_question || form.background ? '它不必马上变成答案，我们可以从这里继续探索' : '可以先从一件真实的小事开始，不急着做选择' }}</text><view v-if="support" class="reflection-support"><SvgIcon :name="support.icon" :size="18" /><text>{{ support.title }}</text></view></view><ActionButton :locked="moving" @click="go(5)">登录，留下这次探索</ActionButton><ActionButton kind="ghost" :arrow="false" :locked="moving" @click="go(4)">回到初步整理，继续修改</ActionButton><text class="local-draft-note">{{ draftSaved ? '匿名浏览 · 草稿已留在这台设备' : '匿名浏览 · 本机草稿尚未保存成功' }}</text></view>

    <view v-if="introduction || draftInfo" class="modal-backdrop" @click.self="introduction = false; draftInfo = false">
      <view class="intro-panel"><view class="modal-handle" /><view class="intro-panel-header"><text class="eyebrow">AGENCY OS</text><button class="icon-button" aria-label="关闭面板" @click="introduction = false; draftInfo = false" hover-class="pressed" :hover-start-time="0" :hover-stay-time="70"><SvgIcon name="close" :size="21" /></button></view>
        <template v-if="introduction"><text class="flow-title">{{ '我还想\n按自己的意愿活一活' }}</text><text class="body-copy">Agency OS 从这个朴素的愿望出发</text><text class="body-copy">{{ '现实会划出边界\n但在尚有余地的地方\n我们仍可以辨认自己的意愿，争取选择' }}</text><text class="body-copy">{{ '这里可以陪你理清工作与方向中的困惑\n比较选择，尝试一点改变\n也给休息、犹豫和重新选择留下位置' }}</text><text class="body-copy">{{ '愿每一次向前\n都更靠近你愿意亲自度过的生活' }}</text><text class="body-copy">{{ '你可以先匿名看看，再决定是否登录保存\nAI 对话需要你单独同意，建议由你确认后才会进入决策卡' }}</text><ActionButton :arrow="false" @click="introduction = false">我知道了</ActionButton></template>
        <template v-else><text class="flow-title">{{ draftSaved ? '草稿已留在这台设备' : '先保留页面里的想法' }}</text><text class="body-copy">{{ draftSaved ? '已核对本机草稿，7 天内可以回来接着探索' : '本机草稿尚未保存，请先不要关闭页面' }}</text><text class="body-copy">{{ '登录保存前，不会上传你的回答\n如果正在使用共用设备，可以随时清除本机草稿' }}</text><ActionButton :arrow="false" @click="draftInfo = false">继续探索</ActionButton><button class="clear-draft" @click="clearDraft" hover-class="pressed" :hover-start-time="0" :hover-stay-time="70">清除本机草稿</button></template>
      </view>
    </view>
  </view>
</template>

<style scoped>
.quick-answers { display:flex; flex-wrap:wrap; gap:10px; margin:18px 0 10px; }
.quick-answer { width:100%; min-height:48px; margin:0; padding:12px 16px; border:1px solid #dce2d8; border-radius:14px; text-align:left; font-size:14px; line-height:1.7; background:#fffdfa; color:#37483d; transition:background 130ms ease,border-color 130ms ease; }
.quick-answer.chosen { background:#e7eee1; border-color:#6f8863; color:#314c35; }
.quick-answer::after,.optional-toggle::after { border:0; }
.optional-toggle { display:block; margin:14px 0 0; padding:12px 0; min-height:44px; text-align:left; color:#52674e; background:transparent; font-size:13px; line-height:1.8; }
.optional-note { display:block; color:#667180; font-size:12px; line-height:1.8; margin-top:10px; }
</style>

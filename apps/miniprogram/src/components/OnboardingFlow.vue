<script setup lang="ts">
import { computed, nextTick, onUnmounted, reactive, ref, watch } from 'vue'
import type { Onboarding } from '../domain'
import { concernOptions, lifeContexts, supportStyles, newOnboarding, toggleConcern, reflectionFor, reflectionHeading, saveDraft, restoreDraft, DRAFT_KEY, branchFor, selectMainline, canonicalSupportStyle } from '../onboarding'
import ActionButton from './ActionButton.vue'
import SelectionCard from './SelectionCard.vue'
import ProgressIndicator from './ProgressIndicator.vue'
import SvgIcon from './SvgIcon.vue'

const props = defineProps<{ busy: boolean; error: string; devAuth: boolean; authenticated: boolean; ready: boolean; offline?: boolean }>()
const emit = defineEmits<{ save: [form: Onboarding, dev: boolean]; privacy: []; retry: []; navigate: [] }>()
let cached: ReturnType<typeof restoreDraft> = null
try {
  const stored = uni.getStorageSync(DRAFT_KEY)
  cached = restoreDraft(stored)
  if (stored && !cached) uni.removeStorageSync(DRAFT_KEY)
} catch { /* Storage can be unavailable. */ }
const form = reactive({ ...newOnboarding(), ...cached?.form })
const step = ref(cached?.step ?? -1)
const accepted = ref(false)
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
const constraintsText = computed({ get: () => form.constraints.join('\n'), set: value => { form.constraints = value.split('\n').map(v => v.trim()).filter(Boolean).slice(0, 12) } })
const canContinue = computed(() => step.value === 0 ? form.concerns.length > 0 : step.value === 1 ? !!form.exploration_intent : step.value === 3 ? !!form.support_style : true)
const headings = [
  { label: 'LET’S BEGIN', title: '最近，你想为自己\n寻找什么？', detail: '可以多选，也可以从一个还不成熟的念头开始' },
  { label: 'A FIRST THREAD', title: '先选一条\n此刻想探索的主线', detail: '其他关注点会保留，可以回来修改' },
  { label: 'ABOUT YOU', title: '此刻的生活\n主要围绕什么展开', detail: '选几个与你有关的词，也可以跳过' },
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
  form.concerns = toggleConcern(form.concerns, id)
  if (!form.concerns.includes(form.exploration_intent || '')) form.exploration_intent = form.concerns.length === 1 ? form.concerns[0] : ''
}
function focus(intent: string) { selectMainline(form, intent) }
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
  draftInfo.value = false
  step.value = -1
  try { uni.removeStorageSync(DRAFT_KEY) } catch { /* Reset still works in memory */ }
}
defineExpose({ clearDraft })
</script>

<template>
  <view class="onboarding-flow" :class="{ 'welcome-scene': step === -1, 'login-scene': step === 5, 'guest-scene': step === 6 }">
    <image v-if="step === -1" class="scene-image welcome-image" src="/static/mountain-lake.jpg" mode="aspectFill" />
    <image v-if="step === 5 || step === 6" class="scene-image wall-image" src="/static/morning-light.jpg" mode="aspectFill" />

    <view v-if="step === -1" key="welcome" class="welcome-content">
      <view class="welcome-brand"><text>AGENCY OS</text><view class="brand-baseline"><view /><text>YOUR SPACE</text></view></view>
      <view class="welcome-copy"><text class="welcome-title">{{ '世界不会总按你的\n期待运行' }}</text><text class="welcome-description">{{ '但你的可能性\n也不止眼前这些' }}</text></view>
      <view class="welcome-bottom"><text class="welcome-footnote">给自己一点空间，也给下一步一点可能</text><ActionButton kind="secondary" :locked="moving" @click="go(0)">开始探索</ActionButton><button class="welcome-about" hover-class="pressed" @click="introduction = true">先了解 Agency OS</button></view>
    </view>

    <view v-else-if="step < 5" key="flow-shell" class="flow-page">
      <view class="flow-chrome">
        <view class="flow-nav"><button class="icon-button flow-back" aria-label="返回上一步" :disabled="busy || moving" hover-class="pressed" :hover-start-time="0" @click="go(step - 1)"><SvgIcon name="back" :size="22" /></button><text class="flow-wordmark">YOUR SPACE</text><button class="icon-button" aria-label="草稿与隐私" hover-class="pressed" :hover-start-time="0" @click="draftInfo = true"><SvgIcon name="more" :size="22" /></button></view>
        <ProgressIndicator :current="step + 1" :total="5" />
      </view>
      <scroll-view class="flow-scroll" scroll-y :scroll-top="scrollTop" :show-scrollbar="false" @scroll="rememberScroll">
        <view :key="'content-' + step" class="flow-body" :class="'flow-' + direction + '-' + (step % 2)">
          <view class="flow-heading"><text class="eyebrow">{{ heading.label }}</text><text class="flow-title">{{ heading.title }}</text><text class="flow-description">{{ heading.detail }}</text></view>
          <view v-if="step === 0" class="selection-stack">
            <template v-for="item in concernOptions" :key="item.id"><SelectionCard :title="item.title" :detail="item.detail" :icon="item.icon" :selected="form.concerns.includes(item.id)" @select="choose(item.id)" /><textarea v-if="item.id === 'other' && form.concerns.includes('other')" v-model="form.actual_question" class="text-area flow-textarea" maxlength="400" placeholder="想到什么，就从哪里说起，也可以留空" :auto-height="true" /></template>
          </view>
          <view v-else-if="step === 1" class="selection-stack">
            <SelectionCard v-for="item in selected" :key="item.id" :title="item.title" radio :selected="form.exploration_intent === item.id" @select="focus(item.id)" />
            <view v-if="form.exploration_intent" class="exploration-branch"><text class="branch-question">{{ branch.question }}</text><text v-if="form.exploration_intent === 'unsure'" class="flow-description">我们暂时还不知道哪条路适合你，可以从经历、兴趣和现实条件里寻找线索</text><textarea v-model="form.focus_response" class="text-area flow-textarea branch-response" maxlength="800" :placeholder="branch.placeholder" :auto-height="true" /><text class="field-label">为这次探索起个名字，可选</text><input v-model="form.title" class="text-field exploration-title" maxlength="120" placeholder="还没想好，可以留空" /></view>
          </view>
          <view v-else-if="step === 2"><view class="life-contexts"><button v-for="item in lifeContexts" :key="item.id" class="context-chip" :class="{ chosen: form.life_contexts?.includes(item.id) }" :aria-pressed="form.life_contexts?.includes(item.id)" hover-class="pressed" :hover-start-time="0" :hover-stay-time="70" @click="context(item.id)">{{ item.title }}</button></view><text class="field-label">你愿意补充的真实经历，可选</text><textarea v-model="form.background" class="text-area flow-textarea" maxlength="400" placeholder="一件做过的事，就足够作为起点" :auto-height="true" /><text class="field-label">重要的现实条件，可选</text><textarea v-model="constraintsText" class="text-area flow-textarea" maxlength="1200" placeholder="时间、收入、精力或地点，每行一项" :auto-height="true" /></view>
          <view v-else-if="step === 3" class="selection-stack"><SelectionCard v-for="item in supportStyles" :key="item.id" :title="item.title" :detail="item.detail" :icon="item.icon" :selected="!!form.support_style && canonicalSupportStyle(form.support_style) === item.id" @select="form.support_style = item.id" /></view>
          <view v-else class="reflection-summary">
            <view class="reflection-card reflection-record"><view class="reflection-mark"><SvgIcon name="compass" :size="24" /><text>你留下的线索，由你解释</text></view>
              <view v-if="form.title" class="reflection-context"><text class="muted">你为这次探索起的名字</text><text class="reflection-copy">{{ form.title }}</text></view>
              <view v-if="form.actual_question" class="reflection-context"><text class="muted">你想探索的问题</text><text class="reflection-copy">{{ form.actual_question }}</text></view>
              <view v-if="form.focus_response && form.focus_response !== form.actual_question" class="reflection-context"><text class="muted">关于当前主线，你补充的</text><text class="reflection-copy">{{ form.focus_response }}</text></view>
              <view v-if="form.background && form.background !== form.focus_response && form.background !== form.actual_question" class="reflection-context"><text class="muted">你填写的经历</text><text class="reflection-copy">{{ form.background }}</text></view>
              <view v-if="form.constraints.length" class="reflection-context"><text class="muted">你想保留的现实条件</text><text v-for="line in form.constraints" :key="line" class="reflection-copy">{{ line }}</text></view>
              <view v-if="contextLabels.length" class="reflection-context"><text class="muted">此刻的生活背景</text><view class="chips"><text v-for="item in contextLabels" :key="item.id" class="tag">{{ item.title }}</text></view></view>
              <text v-if="!form.title && !form.actual_question && !form.focus_response && !form.background && !form.constraints.length && !contextLabels.length" class="reflection-copy reflection-empty">你选择先看看，具体线索可以慢慢补充</text>
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
      <view class="login-heading"><text class="eyebrow">KEEP YOUR EXPLORATION</text><text class="flow-title">{{ '把这次探索留在这里\n下次回来继续' }}</text><text class="flow-description">不是注册才能获得答案，而是让你可以接着自己的线索往前走</text></view>
      <view class="login-focus"><SvgIcon name="compass" :size="22" /><view class="login-focus-copy"><text class="muted">这次探索的起点</text><text>{{ form.title || '一次还未命名的探索' }}</text></view></view>
      <view v-if="error || localError" class="notice">{{ error || localError }}</view>
      <view v-else-if="offline" class="notice">暂时无法连接服务，你可以继续浏览，连接恢复后再保存</view>
      <view class="login-actions">
        <!-- #ifdef MP-WEIXIN -->
        <ActionButton kind="wechat" :disabled="!accepted" :loading="busy" @click="submit(false)">微信快捷登录 / 注册</ActionButton>
        <!-- #endif -->
        <ActionButton v-if="devAuth" :disabled="!accepted" :loading="busy" @click="submit(true)">本地开发演示登录</ActionButton>
        <text v-if="devAuth" class="demo-login-note">开发登录不连接微信，AI 对话仍需另行授权</text>
        <!-- #ifdef H5 -->
        <text v-if="!devAuth && ready" class="demo-login-note">请在微信小程序中完成登录</text>
        <!-- #endif -->
        <button v-if="offline" class="text-button" :disabled="busy" @click="$emit('retry')" hover-class="pressed" :hover-start-time="0" :hover-stay-time="70">重新连接服务</button>
        <view class="login-consent"><button class="consent-check-target" aria-label="同意用户协议与隐私政策" :aria-pressed="accepted" @click="accepted = !accepted" hover-class="pressed" :hover-start-time="0" :hover-stay-time="70"><view class="consent-box" :class="{ checked: accepted }"><SvgIcon v-if="accepted" name="check" light :size="13" /></view></button><view class="consent-copy"><text>我已阅读并同意</text><button class="policy-link" @click="$emit('privacy')" hover-class="pressed" :hover-start-time="0" :hover-stay-time="70">《用户协议》与《隐私政策》</button></view></view>
        <ActionButton kind="ghost" :arrow="false" :locked="moving" @click="go(6)">暂不注册，继续看看</ActionButton>
      </view>
      <text class="login-bottom-note">你的想法，值得被认真对待</text>
    </view>

    <view v-else key="guest" class="guest-content"><text class="eyebrow">YOUR SPACE</text><text class="flow-title">{{ '你好\n这是你的探索起点' }}</text><text class="flow-description">从一点真实的好奇开始</text><view class="reflection-card"><text class="eyebrow">一次可以修改的探索</text><text class="reflection-title">{{ form.title || '先留住这一点好奇' }}</text><text v-if="form.focus_response || form.actual_question || form.background" class="guest-clue">{{ form.focus_response || form.actual_question || form.background }}</text><text class="reflection-copy">{{ form.focus_response || form.actual_question || form.background ? '它不必马上变成答案，我们可以从这里继续探索' : '可以先从一件真实的小事开始，不急着做选择' }}</text><view v-if="support" class="reflection-support"><SvgIcon :name="support.icon" :size="18" /><text>{{ support.title }}</text></view></view><ActionButton :locked="moving" @click="go(5)">登录，留下这次探索</ActionButton><ActionButton kind="ghost" :arrow="false" :locked="moving" @click="go(4)">回到初步整理，继续修改</ActionButton><text class="local-draft-note">{{ draftSaved ? '匿名浏览 · 草稿已留在这台设备' : '匿名浏览 · 本机草稿尚未保存成功' }}</text></view>

    <view v-if="introduction || draftInfo" class="modal-backdrop" @click.self="introduction = false; draftInfo = false">
      <view class="intro-panel"><view class="modal-handle" /><view class="intro-panel-header"><text class="eyebrow">AGENCY OS</text><button class="icon-button" aria-label="关闭面板" @click="introduction = false; draftInfo = false" hover-class="pressed" :hover-start-time="0" :hover-stay-time="70"><SvgIcon name="close" :size="21" /></button></view>
        <template v-if="introduction"><text class="flow-title">{{ '你的生活，你的方向\n你的选择权' }}</text><text class="body-copy">{{ '从真实的处境出发，一起理清重要的事情\n找到愿意尝试的下一步' }}</text><text class="body-copy">{{ '你可以先匿名看看，再决定是否登录保存\nAI 对话需要你单独同意，建议由你确认后才会进入决策卡' }}</text><ActionButton :arrow="false" @click="introduction = false">我知道了</ActionButton></template>
        <template v-else><text class="flow-title">{{ draftSaved ? '草稿已留在这台设备' : '先保留页面里的想法' }}</text><text class="body-copy">{{ draftSaved ? '已核对本机草稿，7 天内可以回来接着探索' : '本机草稿尚未保存，请先不要关闭页面' }}</text><text class="body-copy">{{ '登录保存前，不会上传你的回答\n如果正在使用共用设备，可以随时清除本机草稿' }}</text><ActionButton :arrow="false" @click="draftInfo = false">继续探索</ActionButton><button class="clear-draft" @click="clearDraft" hover-class="pressed" :hover-start-time="0" :hover-stay-time="70">清除本机草稿</button></template>
      </view>
    </view>
  </view>
</template>

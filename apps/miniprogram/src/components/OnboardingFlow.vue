<script setup lang="ts">
import { computed, nextTick, onUnmounted, reactive, ref, watch } from 'vue'
import type { Onboarding } from '../domain'
import { concernOptions, lifeContexts, supportStyles, newOnboarding, toggleConcern, reflectionFor, saveDraft, restoreDraft, DRAFT_KEY } from '../onboarding'
import ActionButton from './ActionButton.vue'
import SelectionCard from './SelectionCard.vue'
import ProgressIndicator from './ProgressIndicator.vue'
import SvgIcon from './SvgIcon.vue'

const props = defineProps<{ busy: boolean; error: string; devAuth: boolean; authenticated: boolean; ready: boolean }>()
const emit = defineEmits<{ save: [form: Onboarding, dev: boolean]; privacy: []; retry: [] }>()
let cached: ReturnType<typeof restoreDraft> = null
try {
  const stored = uni.getStorageSync(DRAFT_KEY)
  cached = restoreDraft(stored)
  if (stored && !cached) uni.removeStorageSync(DRAFT_KEY)
} catch { /* Storage can be unavailable. */ }
const form = reactive({ ...newOnboarding(), ...cached?.form })
// Migrate only this former built-in label, preserving punctuation in user input
if (form.title === '我也不知道，帮我一起理清\u3002') form.title = '我也不知道，帮我一起理清'
const step = ref(cached?.step ?? -1)
const accepted = ref(false)
const introduction = ref(false)
const draftInfo = ref(false)
const localError = ref('')
const moving = ref(false)
const direction = ref('forward')
const scrollTop = ref(0)
let lastScrollTop = 0
let navigationTimer: ReturnType<typeof setTimeout> | undefined
const selected = computed(() => concernOptions.filter(item => form.concerns.includes(item.id)))
const reflection = computed(() => reflectionFor(form))
const contextLabels = computed(() => lifeContexts.filter(item => form.life_contexts?.includes(item.id)))
const support = computed(() => supportStyles.find(item => item.id === form.support_style))
const canContinue = computed(() => step.value === 0 ? form.concerns.length > 0 : step.value === 1 ? !!form.title : step.value === 3 ? !!form.support_style : true)
const headings = [
  { label: 'LET’S BEGIN', title: '最近，哪些事情\n让你有些无力', detail: '可以多选，不用急着把一切解释清楚' },
  { label: 'FOCUS', title: '今天，你想先从\n哪一件事开始', detail: '其他的可以先放在这里，之后再慢慢谈' },
  { label: 'ABOUT YOU', title: '此刻的生活\n主要围绕什么展开', detail: '选几个与你有关的词，也可以跳过' },
  { label: 'YOUR STYLE', title: '此刻，你希望\n得到怎样的帮助', detail: '按自己的节奏来，以后也可以改变' },
  { label: 'A LITTLE CLARITY', title: '先把这些想法\n轻轻放在这里', detail: '来自你刚才的选择，还没有使用 AI' },
]
const heading = computed(() => headings[step.value] || headings[0])

function persist() {
  try { uni.setStorageSync(DRAFT_KEY, saveDraft(form, step.value)); localError.value = '' }
  catch { localError.value = '本机暂时无法保存草稿，请先不要关闭页面' }
}
watch([form, step], persist, { deep: true, flush: 'sync' })
function go(value: number) {
  if (moving.value || props.busy || value === step.value) return
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
  form.title = ''
  if (!form.concerns.includes('other')) form.background = ''
}
function focus(title: string) { form.title = title.slice(0, 120) }
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
      <view class="welcome-copy"><text class="welcome-title">{{ '世界不会总按你的\n期待运行' }}</text><text class="welcome-description">{{ '但你仍然可以决定\n下一步往哪里走' }}</text></view>
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
            <template v-for="item in concernOptions" :key="item.id"><SelectionCard :title="item.title" :icon="item.icon" :selected="form.concerns.includes(item.id)" @select="choose(item.id)" /><textarea v-if="item.id === 'other' && form.concerns.includes('other')" v-model="form.background" class="text-area flow-textarea" maxlength="400" placeholder="想到什么，就从哪里说起，也可以留空" :auto-height="true" /></template>
          </view>
          <view v-else-if="step === 1" class="selection-stack">
            <SelectionCard v-for="item in selected.filter(value => value.id !== 'unsure')" :key="item.id" :title="item.id === 'other' && form.background.trim() ? form.background.slice(0, 120) : item.title" radio :selected="form.title === (item.id === 'other' && form.background.trim() ? form.background.slice(0, 120) : item.title)" @select="focus(item.id === 'other' && form.background.trim() ? form.background : item.title)" />
            <SelectionCard title="我也不知道，帮我一起理清" radio :selected="form.title === '我也不知道，帮我一起理清'" @select="focus('我也不知道，帮我一起理清')" />
          </view>
          <view v-else-if="step === 2" class="life-contexts"><button v-for="item in lifeContexts" :key="item.id" class="context-chip" :class="{ chosen: form.life_contexts?.includes(item.id) }" :aria-pressed="form.life_contexts?.includes(item.id)" hover-class="pressed" :hover-start-time="0" :hover-stay-time="70" @click="context(item.id)">{{ item.title }}</button></view>
          <view v-else-if="step === 3" class="selection-stack"><SelectionCard v-for="item in supportStyles" :key="item.id" :title="item.title" :detail="item.detail" :icon="item.icon" :selected="form.support_style === item.id" @select="form.support_style = item.id" /></view>
          <view v-else class="reflection-card"><view class="reflection-mark"><SvgIcon name="compass" :size="24" /><text>你刚才留下的线索</text></view><text class="reflection-title">{{ form.title }}</text><text class="reflection-copy">{{ reflection }}</text><view v-if="contextLabels.length" class="reflection-context"><text class="muted">此刻的生活背景</text><view class="chips"><text v-for="item in contextLabels" :key="item.id" class="tag">{{ item.title }}</text></view></view><view v-if="support" class="reflection-support"><SvgIcon :name="support.icon" :size="19" /><text>{{ support.title }}</text></view><text class="reflection-note">这些是你选择的处境与偏好，不是对你的定义</text></view>
        </view>
      </scroll-view>
      <view class="flow-footer">
        <view v-if="error || localError" class="notice">{{ error || localError }}</view>
        <ActionButton v-if="step < 4" :disabled="!canContinue" :locked="moving" @click="go(step + 1)">继续</ActionButton>
        <ActionButton v-else :loading="busy" :locked="moving" @click="reflectionAction">保存我的方向</ActionButton>
        <view class="flow-footer-detail"><button v-if="step === 2" class="flow-skip" :disabled="moving" @click="skipContext" hover-class="pressed" :hover-start-time="0" :hover-stay-time="70">暂时跳过</button><button v-else-if="step === 4 && !authenticated" class="flow-skip" :disabled="moving" @click="go(6)" hover-class="pressed" :hover-start-time="0" :hover-stay-time="70">暂时不注册</button><button v-else class="draft-link" @click="draftInfo = true" hover-class="pressed" :hover-start-time="0" :hover-stay-time="70"><SvgIcon name="lock" :size="12" /><text>仅保存在你的设备</text></button></view>
      </view>
    </view>

    <view v-else-if="step === 5" key="login" class="login-content">
      <button class="login-back" hover-class="pressed" :disabled="moving" @click="go(4)"><SvgIcon name="back" :size="19" /><text>返回整理</text></button>
      <view class="login-heading"><text class="eyebrow">CREATE YOUR SPACE</text><text class="flow-title">{{ '为自己，留一个\n可以重新出发的地方' }}</text><text class="flow-description">{{ '保存刚才的思考\n下次回来，可以从这里继续' }}</text></view>
      <view class="login-focus"><SvgIcon name="compass" :size="22" /><view class="login-focus-copy"><text class="muted">从这一件事开始</text><text>{{ form.title }}</text></view></view>
      <view v-if="error || localError" class="notice">{{ error || localError }}</view>
      <view class="login-actions">
        <!-- #ifdef MP-WEIXIN -->
        <ActionButton kind="wechat" :disabled="!accepted || !ready" :loading="busy" @click="submit(false)">微信快捷登录 / 注册</ActionButton>
        <!-- #endif -->
        <ActionButton v-if="devAuth" :disabled="!accepted || !ready" :loading="busy" @click="submit(true)">体验本地演示</ActionButton>
        <text v-if="devAuth" class="demo-login-note">开发演示 · 不连接微信，不调用模型</text>
        <!-- #ifdef H5 -->
        <text v-if="!devAuth && ready" class="demo-login-note">请在微信小程序中完成登录</text>
        <!-- #endif -->
        <button v-if="!ready" class="text-button" @click="$emit('retry')" hover-class="pressed" :hover-start-time="0" :hover-stay-time="70">重新连接本地服务</button>
        <view class="login-consent"><button class="consent-check-target" aria-label="同意用户协议与隐私政策" :aria-pressed="accepted" @click="accepted = !accepted" hover-class="pressed" :hover-start-time="0" :hover-stay-time="70"><view class="consent-box" :class="{ checked: accepted }"><SvgIcon v-if="accepted" name="check" light :size="13" /></view></button><view class="consent-copy"><text>我已阅读并同意</text><button class="policy-link" @click="$emit('privacy')" hover-class="pressed" :hover-start-time="0" :hover-stay-time="70">《用户协议》与《隐私政策》</button></view></view>
        <ActionButton kind="ghost" :arrow="false" :locked="moving" @click="go(6)">暂不注册，继续看看</ActionButton>
      </view>
      <text class="login-bottom-note">你的想法，值得被认真对待</text>
    </view>

    <view v-else key="guest" class="guest-content"><text class="eyebrow">YOUR SPACE</text><text class="flow-title">{{ '你好\n欢迎来到你的空间' }}</text><text class="flow-description">{{ '按自己的节奏\n慢慢看清真实的自己' }}</text><view class="reflection-card"><text class="eyebrow">此刻，先照顾这一件事</text><text class="reflection-title">{{ form.title }}</text><text class="reflection-copy">{{ reflection }}</text></view><ActionButton :locked="moving" @click="go(5)">登录，留下这份思考</ActionButton><ActionButton kind="ghost" :arrow="false" :locked="moving" @click="go(4)">回到初步整理，继续修改</ActionButton><text class="local-draft-note">匿名浏览 · 草稿只保存在本机</text></view>

    <view v-if="introduction || draftInfo" class="modal-backdrop" @click.self="introduction = false; draftInfo = false">
      <view class="intro-panel"><view class="modal-handle" /><view class="intro-panel-header"><text class="eyebrow">AGENCY OS</text><button class="icon-button" aria-label="关闭面板" @click="introduction = false; draftInfo = false" hover-class="pressed" :hover-start-time="0" :hover-stay-time="70"><SvgIcon name="close" :size="21" /></button></view>
        <template v-if="introduction"><text class="flow-title">{{ '你的生活，你的方向\n你的选择权' }}</text><text class="body-copy">{{ '从真实的处境出发，一起理清重要的事情\n找到愿意尝试的下一步' }}</text><text class="body-copy">{{ '你可以先匿名看看，再决定是否登录保存\nAI 对话需要你单独同意，建议由你确认后才会进入决策卡' }}</text><ActionButton :arrow="false" @click="introduction = false">我知道了</ActionButton></template>
        <template v-else><text class="flow-title">慢慢来，想法会留在这里</text><text class="body-copy">{{ '引导草稿仅保存在当前设备，7 天内可以回来接着整理\n登录保存前，不会上传你的回答' }}</text><text class="body-copy">如果正在使用共用设备，可以随时清除本机草稿</text><ActionButton :arrow="false" @click="draftInfo = false">继续整理</ActionButton><button class="clear-draft" @click="clearDraft" hover-class="pressed" :hover-start-time="0" :hover-stay-time="70">清除本机草稿</button></template>
      </view>
    </view>
  </view>
</template>

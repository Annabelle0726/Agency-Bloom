<script setup lang="ts">
import { computed, nextTick, onUnmounted, reactive, ref, watch } from 'vue'
import type { Onboarding } from '../domain'
import { startingConcernOptions, focusChoicesFor, concernOptions, lifeContexts, supportStyles, newOnboarding, toggleConcern, reflectionFor, reflectionHeading, saveDraft, restoreDraft, DRAFT_KEY, branchFor, selectMainline, canonicalSupportStyle } from '../onboarding'
import ActionButton from './ActionButton.vue'
import SelectionCard from './SelectionCard.vue'
import ProgressIndicator from './ProgressIndicator.vue'
import SvgIcon from './SvgIcon.vue'
import { draftKeyFor, questionStep } from '../entry'

const props = defineProps<{ busy: boolean; error: string; userId: string }>()
const emit = defineEmits<{ save: [form: Onboarding]; privacy: []; skip: []; navigate: [] }>()
const draftKey = draftKeyFor(props.userId)
let cached: ReturnType<typeof restoreDraft> = null
try {
  const stored = uni.getStorageSync(draftKey)
  cached = restoreDraft(stored)
  if (stored && !cached) uni.removeStorageSync(draftKey)
} catch { /* Storage can be unavailable. */ }
const form = reactive({ ...newOnboarding(), ...cached?.form })
if (!form.exploration_intent && form.concerns.length === 1) form.exploration_intent = form.concerns[0]
const step = ref(questionStep(cached?.step))
const legacyDraft = ref<ReturnType<typeof restoreDraft>>(null)
if (!cached) {
  try { legacyDraft.value = restoreDraft(uni.getStorageSync(DRAFT_KEY)) } catch { /* Optional legacy recovery. */ }
}
function recoverLegacyDraft() {
  if (!legacyDraft.value) return
  Object.assign(form, legacyDraft.value.form)
  if (!form.exploration_intent && form.concerns.length === 1) form.exploration_intent = form.concerns[0]
  step.value = questionStep(legacyDraft.value.step)
  otherOpen.value = !!form.actual_question
  responseOpen.value = !!form.title || (!!form.focus_response && !focusChoicesFor(form).includes(form.focus_response))
  detailsOpen.value = !!form.background || form.constraints.length > 0
  persist()
  if (draftSaved.value) {
    try { uni.removeStorageSync(DRAFT_KEY) } catch { /* Keep the original if unavailable. */ }
    legacyDraft.value = null
  }
}
const otherOpen = ref(!!form.actual_question)
const responseOpen = ref(!!form.title || (!!form.focus_response && !focusChoicesFor(form).includes(form.focus_response)))
const detailsOpen = ref(!!form.background || form.constraints.length > 0)
const focusChoices = computed(() => focusChoicesFor(form))
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
    uni.setStorageSync(draftKey, draft)
    if (JSON.stringify(uni.getStorageSync(draftKey)) !== JSON.stringify(draft)) throw Error('Local write not confirmed')
    draftSaved.value = true; localError.value = ''
  } catch { draftSaved.value = false; localError.value = '本机暂时无法保存草稿，请先不要关闭页面' }
}
watch([form, step], persist, { deep: true, flush: 'sync' })
function go(value: number) {
  if (moving.value || props.busy || value === step.value) return
  if (value < 0) { emit('skip'); return }
  value = questionStep(value)
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
function submit() {
  if (props.busy) return
  emit('save', JSON.parse(JSON.stringify(form)))
}
function clearDraft() {
  clearTimeout(navigationTimer)
  moving.value = false
  Object.assign(form, newOnboarding())
  otherOpen.value = false
  responseOpen.value = false
  detailsOpen.value = false
  draftInfo.value = false
  step.value = 0
  try { uni.removeStorageSync(draftKey) } catch { /* Reset still works in memory */ }
}
defineExpose({ clearDraft })
</script>

<template>
  <view class="onboarding-flow">
    <view key="flow-shell" class="flow-page">
      <view class="flow-chrome">
        <view class="flow-nav"><button class="icon-button flow-back" aria-label="返回上一步" :disabled="busy || moving" hover-class="pressed" :hover-start-time="0" @click="go(step - 1)"><SvgIcon name="back" :size="22" /></button><text class="flow-wordmark">YOUR SPACE</text><button class="icon-button" aria-label="草稿与隐私" hover-class="pressed" :hover-start-time="0" @click="draftInfo = true"><SvgIcon name="more" :size="22" /></button></view>
        <ProgressIndicator :current="step + 1" :total="5" />
      </view>
      <scroll-view class="flow-scroll" scroll-y :scroll-top="scrollTop" :show-scrollbar="false" @scroll="rememberScroll">
        <view :key="'content-' + step" class="flow-body" :class="'flow-' + direction + '-' + (step % 2)">
          <view class="flow-heading"><text class="eyebrow">{{ heading.label }}</text><text class="flow-title">{{ heading.title }}</text><text class="flow-description">{{ heading.detail }}</text></view>
          <view v-if="legacyDraft && step === 0" class="legacy-draft">
            <text>这台设备还有之前的回答，要接着整理吗？</text>
            <button class="text-button" @click="recoverLegacyDraft">恢复本机草稿</button>
            <button class="text-button" @click="legacyDraft = null">这次先不使用</button>
          </view>
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
        <view v-if="localError || error" class="notice">{{ localError || error }}</view>
        <ActionButton v-if="step < 4" :disabled="!canContinue" :locked="moving" @click="go(step + 1)">继续</ActionButton>
        <ActionButton v-else :loading="busy" :locked="moving" @click="submit">保存这次探索</ActionButton>
        <view class="flow-footer-detail">
          <button class="flow-skip" :disabled="busy || moving" @click="emit('skip')" hover-class="pressed">稍后再说，先进入空间</button>
          <button class="draft-link" @click="draftInfo = true"><SvgIcon name="lock" :size="12" /><text>{{ draftSaved ? '本机草稿已保留' : '回答暂不上传' }}</text></button>
        </view>
      </view>
    </view>

    <view v-if="draftInfo" class="modal-backdrop" @click.self="draftInfo = false">
      <view class="intro-panel"><view class="modal-handle" /><view class="intro-panel-header"><text class="eyebrow">AGENCY OS</text><button class="icon-button" aria-label="关闭面板" @click="draftInfo = false" hover-class="pressed" :hover-start-time="0" :hover-stay-time="70"><SvgIcon name="close" :size="21" /></button></view>
        <template><text class="flow-title">{{ draftSaved ? '草稿已留在这台设备' : '先保留页面里的想法' }}</text><text class="body-copy">{{ draftSaved ? '已核对本机草稿，7 天内可以回来接着探索' : '本机草稿尚未保存，请先不要关闭页面' }}</text><text class="body-copy">{{ '点击「保存这次探索」前，不会上传你的回答\n如果正在使用共用设备，可以随时清除本机草稿' }}</text><ActionButton :arrow="false" @click="draftInfo = false">继续探索</ActionButton><button class="clear-draft" @click="clearDraft" hover-class="pressed" :hover-start-time="0" :hover-stay-time="70">清除本机草稿</button></template>
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
.legacy-draft { padding:16px; margin-bottom:20px; background:#edf0e7; border-radius:16px; font-size:13px; line-height:1.8; }
.flow-footer-detail { flex-wrap:wrap; gap:4px 12px; }
</style>

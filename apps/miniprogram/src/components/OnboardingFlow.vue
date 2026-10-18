<script setup lang="ts">
import { computed, nextTick, onUnmounted, reactive, ref, watch } from 'vue'
import type { Onboarding } from '../domain'
import { startingConcernOptions, focusChoicesFor, concernOptions, lifeContexts, supportStyles, newOnboarding, toggleConcern, reflectionFor, reflectionHeading, saveDraft, restoreDraft, DRAFT_KEY, branchFor, selectMainline, canonicalSupportStyle } from '../onboarding'
import ActionButton from './ActionButton.vue'
import SelectionCard from './SelectionCard.vue'
import ProgressIndicator from './ProgressIndicator.vue'
import SvgIcon from './SvgIcon.vue'
import { choiceArtwork } from '../choice-art'
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
  { label: 'LET’S BEGIN', title: '最近，有什么让你\n感到焦虑、害怕或不安？', detail: '选下最近挂心的事，也可以带着好奇来。可以多选。' },
  { label: 'A FIRST THREAD', title: '我们先从\n一件小事聊起', detail: '点选就好，暂时没有答案也可以继续' },
  { label: 'ABOUT YOU', title: '此刻的生活\n主要围绕什么展开', detail: '点亮与你有关的小球，可以多选，也可以先跳过' },
  { label: 'YOUR STYLE', title: '此刻，你希望\n得到怎样的帮助', detail: '按自己的节奏来，以后也可以改变' },
  { label: 'A BEGINNING', title: '这是一次探索的起点\n而不是对你的定义', detail: '根据固定问题整理，还没有使用 AI' },
]
const heading = computed(() => headings[step.value] || headings[0])
const scenes = ['water', 'path', 'rest', 'meadow', 'dawn']
const scene = computed(() => '/static/opening-' + scenes[step.value] + '.jpg')
const visualTones: Record<string, string> = {
  direction: 'sage', change: 'rose', choices: 'sage', start: 'water',
  other: 'lilac', possibility: 'gold', unsure: 'water',
  listen: 'rose', discover: 'gold', compare: 'sage', experiment: 'water',
}
function visual(id: string) {
  return { artwork: choiceArtwork[id as keyof typeof choiceArtwork] || choiceArtwork.unsure, tone: visualTones[id] || 'sage' }
}
function bubbleLabel(id: string, title: string) { return id === 'rest' ? '休整与\n重新出发' : title }
const contextIcons: Record<string, string> = {
  studying: 'note', searching: 'compass', working: 'layers', transition: 'step',
  freelance: 'sun', business: 'spark', creating: 'note', care: 'home',
  rest: 'sun', retired: 'sun', other: 'chat',
}
const selectedNote = computed(() => step.value === 0
  ? (form.concerns.length ? '已选 ' + form.concerns.length + ' 项 · 都可以慢慢聊' : '没有标准答案，选接近你的就好')
  : step.value === 2 ? (form.life_contexts?.length ? '已点亮 ' + form.life_contexts.length + ' 个 · 生活可以有很多面' : '点一下选中，再点一下取消') : '你的选择，之后仍然可以改变')


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
  if (props.busy || moving.value) return
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
  <view class="onboarding-flow" :class="'question-scene-' + step">
    <view class="question-backdrop" aria-hidden="true">
      <image :key="scene" :src="scene" mode="aspectFill" />
      <view class="question-wash" />
    </view>
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
            <SelectionCard v-for="item in startingConcernOptions" :key="item.id" :title="item.title" :detail="item.detail" :icon="item.icon" :artwork="visual(item.id).artwork" :tone="visual(item.id).tone" :selected="form.concerns.includes(item.id)" @select="choose(item.id)" />
            <view v-if="form.concerns.includes('other') || form.actual_question" class="optional-writing">
              <button class="optional-toggle" :aria-expanded="otherOpen" @click="otherOpen = !otherOpen" hover-class="pressed">{{ otherOpen ? '收起补充' : '我想补充一句（选填）' }}</button>
              <textarea v-if="otherOpen" v-model="form.actual_question" class="text-area flow-textarea" maxlength="400" placeholder="一句话就好，也可以不写" :auto-height="true" />
            </view>
          </view>
          <view v-else-if="step === 1" class="selection-stack">
            <template v-if="selected.length > 1">
              <text class="field-label">先聊哪一个方向？</text>
              <SelectionCard v-for="item in selected" :key="item.id" :title="item.title" :artwork="visual(item.id).artwork" :tone="visual(item.id).tone" radio :selected="form.exploration_intent === item.id" @select="focus(item.id)" />
            </template>
            <view v-if="form.exploration_intent" class="exploration-branch">
              <text class="branch-question">{{ branch.question }}</text>
              <text class="flow-description">选一个接近的，也可以不选</text>
              <view class="quick-answers">
                <button v-for="(answer, answerIndex) in focusChoices" :key="answer" class="quick-answer" :class="{ chosen: form.focus_response === answer }"
                  :aria-pressed="form.focus_response === answer" @click="chooseFocus(answer)" hover-class="pressed" :hover-start-time="0"><view class="answer-symbol"><SvgIcon :name="['sun', 'paths', 'spark', 'step'][answerIndex % 4]" :size="21" /></view><text>{{ answer }}</text><view class="answer-indicator"><SvgIcon v-if="form.focus_response === answer" name="check" :size="14" /></view></button>
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
            <view class="life-contexts" aria-label="生活背景，可多选">
                <button v-for="item in lifeContexts" :key="item.id" class="context-bubble"
                  :class="[{ chosen: form.life_contexts?.includes(item.id) }, 'bubble-' + item.id]"
                  :data-context="item.id" :aria-label="item.title" :aria-pressed="!!form.life_contexts?.includes(item.id)"
                  :disabled="busy || moving" hover-class="bubble-pressed" :hover-start-time="0" :hover-stay-time="90"
                  @click="context(item.id)">
                  <view class="bubble-glint" aria-hidden="true" />
                  <view class="bubble-content"><SvgIcon :name="contextIcons[item.id]" :light="form.life_contexts?.includes(item.id)" :size="26" /><text>{{ bubbleLabel(item.id, item.title) }}</text></view>
                  <view v-if="form.life_contexts?.includes(item.id)" class="bubble-check"><SvgIcon name="check" light :size="13" /></view>
                </button>
            </view>
            <button class="optional-toggle" :aria-expanded="detailsOpen" @click="detailsOpen = !detailsOpen" hover-class="pressed">{{ detailsOpen ? '收起补充' : '有一点经历或现实条件想补充（选填）' }}</button>
            <view v-if="detailsOpen">
              <text class="field-label">愿意补充的经历，选填</text><textarea v-model="form.background" class="text-area flow-textarea" maxlength="400" placeholder="一句话、一件小事就够了" :auto-height="true" />
              <text class="field-label">想照顾到的现实条件，选填</text><textarea v-model="constraintsText" class="text-area flow-textarea" maxlength="1200" placeholder="比如时间、收入或精力，也可以以后聊" :auto-height="true" />
            </view>
          </view>
          <view v-else-if="step === 3" class="selection-stack"><SelectionCard v-for="item in supportStyles" :key="item.id" :title="item.title" :detail="item.detail" :icon="item.icon" :artwork="visual(item.id).artwork" :tone="visual(item.id).tone" :selected="!!form.support_style && canonicalSupportStyle(form.support_style) === item.id" @select="form.support_style = item.id" /></view>
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
        <text v-if="step < 4" class="selection-reassurance">{{ selectedNote }}</text>
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
.quick-answer { width:100%; min-height:48px; margin:0; padding:12px 16px; border:1px solid #dce2d8; border-radius:8px; text-align:left; font-size:14px; line-height:1.7; background:#fffdfa; color:#37483d; transition:background 130ms ease,border-color 130ms ease; }
.quick-answer.chosen { background:#e7eee1; border-color:#6f8863; color:#314c35; }
.quick-answer::after,.optional-toggle::after { border:0; }
.optional-toggle { display:block; margin:14px 0 0; padding:12px 0; min-height:44px; text-align:left; color:#52674e; background:transparent; font-size:13px; line-height:1.8; }
.optional-note { display:block; color:#667180; font-size:12px; line-height:1.8; margin-top:10px; }
.legacy-draft { padding:16px; margin-bottom:20px; background:#edf0e7; border-radius:8px; font-size:13px; line-height:1.8; }
.flow-footer-detail { flex-wrap:wrap; gap:4px 12px; }

/* The imagery stays behind readable, tactile choices throughout the five steps. */
.onboarding-flow { isolation:isolate; background:#f0f3e9; }
.question-backdrop { position:absolute; inset:0; z-index:0; pointer-events:none; overflow:hidden; }
.question-backdrop > image { position:absolute; width:100%; height:100%; opacity:.65; }
.question-wash { position:absolute; inset:0; background:linear-gradient(180deg,rgba(248,249,242,.28),rgba(246,248,239,.76) 33%,rgba(239,244,232,.9) 75%,#f1f4e9); }
.question-scene-1 .question-wash { background:linear-gradient(180deg,rgba(248,249,242,.4),rgba(246,248,239,.83) 40%,rgba(239,244,232,.94)); }
.question-scene-2 .question-wash { background:linear-gradient(180deg,rgba(250,245,235,.25),rgba(250,245,235,.83) 45%,#f8f3e8); }
.flow-page { position:relative; z-index:1; background:transparent; }
.flow-chrome { padding-top:calc(var(--capsule-bottom,64px) + 12px); }
.flow-nav { margin-bottom:15px; }
.flow-wordmark { color:#62755d; }
.flow-body { padding-top:25px; }
.flow-heading { position:relative; padding-bottom:22px; }
.flow-heading .eyebrow { color:#708362; letter-spacing:2.4px; }
.flow-heading .flow-title { font-family:'Kaiti SC','STKaiti','KaiTi',var(--font-heading); font-size:28px; line-height:1.55; letter-spacing:.7px; color:#334b38; }
.flow-heading .flow-description { color:#65755d; font-size:13px; line-height:1.9; max-width:95%; margin-top:13px; }
.selection-stack { gap:13px; }
.flow-footer { background:rgba(246,248,240,.96); border-top:1px solid rgba(115,137,93,.15); padding-top:10px; box-shadow:0 -8px 30px rgba(71,89,58,.025); }
.selection-reassurance { display:block; text-align:center; color:#697c5e; font-size:11px; line-height:1.8; margin:0 0 9px; }
.flow-footer :deep(.action-button) { border-radius:8px; }
.flow-footer :deep(.action-button.primary) { background:#48664b; }
.flow-footer :deep(.action-button[disabled]) { background:#e0e7da; color:#8a9882; }
.flow-footer-detail { justify-content:space-between; }
.flow-footer .flow-skip { color:#516c48; font-size:12px; }
.flow-footer .draft-link { font-size:10px; }
:deep(.progress-track) { height:3px; background:rgba(100,122,77,.16); }
:deep(.progress-fill) { background:#6c8454; }
:deep(.progress-count) { color:#647856; }
.exploration-branch { padding:20px 18px; border:1px solid rgba(255,255,255,.95); border-radius:10px; background:rgba(255,253,247,.8); box-shadow:0 6px 24px rgba(60,79,46,.04); }
.branch-question { font-family:var(--font-heading); font-size:19px; line-height:1.8; color:#3b523a; }
.quick-answer { display:flex; align-items:center; gap:12px; padding:12px; border:1px solid #e1e7d8; border-radius:8px; background:rgba(255,255,250,.9); }
.quick-answer > text { flex:1; }
.answer-symbol { flex-shrink:0; width:39px; height:39px; border-radius:8px; background:#eff1e2; display:flex; align-items:center; justify-content:center; }
.answer-indicator { flex-shrink:0; width:18px; height:18px; border:1px solid #c0cbae; border-radius:50%; display:flex; align-items:center; justify-content:center; }
.quick-answer.chosen { background:#e4ecd9; border-color:#738d59; }
.life-contexts { position:relative; width:100%; height:0; padding-bottom:140%; margin:0 0 10px; }
.context-bubble { --bubble-tint:#e4ecd9; --bubble-deep:#536e47; position:absolute; z-index:1; display:block; width:30%; height:0; min-height:0; box-sizing:content-box; padding:0 0 30%; margin:0; border-radius:50%; border:1px solid rgba(255,255,255,.95); background:radial-gradient(circle at 30% 22%,#fffef9 0%,var(--bubble-tint) 76%); box-shadow:inset 0 2px 3px rgba(255,255,255,.9),inset -3px -5px 9px rgba(85,111,62,.08),0 6px 14px rgba(73,86,55,.08); color:#40583c; text-align:center; overflow:visible; transition:transform 180ms ease,box-shadow 180ms ease,background 180ms ease; }
.context-bubble::after { border:0; }
.bubble-content { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; pointer-events:none; }
.bubble-content text { display:block; max-width:86px; font-size:12px; line-height:1.5; white-space:pre-line; font-weight:500; }
.bubble-glint { position:absolute; top:12%; left:20%; width:23%; height:11%; border-radius:50%; background:rgba(255,255,255,.55); transform:rotate(-32deg); pointer-events:none; }
.bubble-searching,.bubble-business,.bubble-retired { --bubble-tint:#f3e4ce; --bubble-deep:#886843; }
.bubble-transition,.bubble-care,.bubble-other { --bubble-tint:#dcece8; --bubble-deep:#426e67; }
.bubble-creating { --bubble-tint:#e8dfee; --bubble-deep:#766381; }
/* A stable, loosely packed cluster: size is expressive, never a priority ranking. */
.bubble-studying { left:9.722%; top:1.587%; width:33.889%; padding-bottom:33.889%; }
.bubble-searching { left:46.389%; top:0.000%; width:25.000%; padding-bottom:25.000%; }
.bubble-working { left:63.333%; top:16.270%; width:36.667%; padding-bottom:36.667%; }
.bubble-transition { left:27.222%; top:21.627%; width:32.500%; padding-bottom:32.500%; }
.bubble-freelance { left:0.000%; top:27.183%; width:27.778%; padding-bottom:27.778%; }
.bubble-business { left:6.111%; top:47.024%; width:31.667%; padding-bottom:31.667%; }
.bubble-creating { left:36.667%; top:44.841%; width:36.667%; padding-bottom:36.667%; }
.bubble-care { left:69.444%; top:47.222%; width:29.167%; padding-bottom:29.167%; }
.bubble-rest { left:21.667%; top:70.437%; width:34.167%; padding-bottom:34.167%; }
.bubble-retired { left:56.111%; top:73.413%; width:28.333%; padding-bottom:28.333%; }
.bubble-other { left:0.000%; top:71.032%; width:23.611%; padding-bottom:23.611%; }
.context-bubble.chosen { z-index:2; background:radial-gradient(circle at 30% 18%,#91a683,var(--bubble-deep) 78%); color:#fffdf6; border-color:var(--bubble-deep); box-shadow:0 0 0 3px rgba(255,255,255,.84),0 7px 18px rgba(61,86,48,.22),inset 0 2px 5px rgba(255,255,255,.22); animation:bubble-pop 300ms cubic-bezier(.2,.8,.3,1); }
.context-bubble.chosen .bubble-glint { background:rgba(255,255,255,.22); }
.bubble-check { position:absolute; top:6px; right:8px; width:22px; height:22px; border-radius:50%; display:flex; align-items:center; justify-content:center; background:var(--bubble-deep); border:2px solid #fffdf5; }
.context-bubble.bubble-pressed { transform:scale(.94); }
@keyframes bubble-pop { 0% { transform:scale(.94); } 55% { transform:scale(1.065); } 100% { transform:scale(1); } }
@media(max-width:360px) { .bubble-content text { font-size:11px; max-width:75px; } .bubble-content { gap:5px; } .bubble-check { width:18px; height:18px; top:4px; right:5px; } }
@media(max-width:330px) { .bubble-content text { font-size:10px; max-width:65px; } }
@media(prefers-reduced-motion:reduce) { .context-bubble,.context-bubble.chosen { animation:none; transition:none; } }
.reflection-card { background:rgba(255,254,248,.91); border:1px solid #fffdf7; border-radius:10px; box-shadow:0 10px 35px rgba(65,78,43,.07); }
.reflection-next { border-top:1px solid rgba(116,134,90,.25); }
.optional-writing { border-radius:8px; padding:0 12px; background:rgba(255,253,248,.7); }
@media(max-width:360px) {
  .flow-heading .flow-title { font-size:25px; }
  .flow-chrome,.flow-body,.flow-footer { padding-left:20px; padding-right:20px; }
}
@media(prefers-reduced-motion:reduce) { .question-backdrop > image { transition:none; } }
</style>
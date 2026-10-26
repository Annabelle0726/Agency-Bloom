<script setup lang="ts">
import { resolveAppMedia } from '../app-media'
import { computed, nextTick, onUnmounted, reactive, ref, watch } from 'vue'
import type { Onboarding } from '../domain'
import { startingConcernOptions, focusChoiceViewsFor, explorationIntroFor, lifeContexts, constraintChoices, supportStyles, newOnboarding, updateConcerns, followUpFor, toggleFollowUp, setFollowUpNote, followUpRecords, submissionFor, saveDraft, restoreDraft, DRAFT_KEY, branchFor, selectMainline, canonicalSupportStyle, onboardingHeadings } from '../onboarding'
import { compactRefinementFor } from '../onboarding-refinements'
import ActionButton from './ActionButton.vue'
import SelectionCard from './SelectionCard.vue'
import ProgressIndicator from './ProgressIndicator.vue'
import SvgIcon from './SvgIcon.vue'
import { draftKeyFor, questionStep } from '../entry'
import { hasRequiredFollowUp, refinementPromptsFor, toggleRefinement } from '../onboarding'
import type { OnboardingSnapshot } from '../onboarding-progress'

const props = defineProps<{ busy: boolean; error: string; userId: string; resume?: OnboardingSnapshot | null; syncMessage?: string; syncMode?: string }>()
const emit = defineEmits<{ save: [form: Onboarding]; privacy: []; skip: []; chat: []; navigate: []; progress: [draft: OnboardingSnapshot]; retrySync: []; keepLocal: []; useRemote: [] }>()
let applyingRemote = false
const draftKey = draftKeyFor(props.userId)
let cached: ReturnType<typeof restoreDraft> = null
try {
  const stored = props.resume || uni.getStorageSync(draftKey)
  cached = restoreDraft(stored)
  if (stored && !cached) uni.removeStorageSync(draftKey)
} catch { /* Storage can be unavailable. */ }
const form = reactive({ ...newOnboarding(), ...cached?.form })
if (!form.exploration_intent && form.concerns.length) form.exploration_intent = form.concerns[0]
function resumeStep(value?: number) {
  return !form.concerns.length ? 0 : !hasRequiredFollowUp(form) ? Math.min(questionStep(value), 1) : questionStep(value)
}
const step = ref(resumeStep(cached?.step))
const legacyDraft = ref<ReturnType<typeof restoreDraft>>(null)
if (!cached) {
  try { legacyDraft.value = restoreDraft(uni.getStorageSync(DRAFT_KEY)) } catch { /* Optional legacy recovery. */ }
}
function recoverLegacyDraft() {
  if (!legacyDraft.value) return
  Object.assign(form, legacyDraft.value.form)
  if (!form.exploration_intent && form.concerns.length) form.exploration_intent = form.concerns[0]
  step.value = resumeStep(legacyDraft.value.step)
  nameOpen.value = !!form.title
  freeOpen.value = !!followUpFor(form).note
  persist()
  if (draftSaved.value) {
    try { uni.removeStorageSync(DRAFT_KEY) } catch { /* Keep the original if unavailable. */ }
    legacyDraft.value = null
  }
}
const nameOpen = ref(!!form.title)
const freeOpen = ref(!!followUpFor(form).note)
const contextOpen = ref(false)
const backgroundOpen = ref(!!form.background)
const constraintsOpen = ref(form.constraints.some(value => !constraintChoices.includes(value)))
const actualQuestionOpen = ref(false)
const focusedField = ref('')
const focusViews = computed(() => focusChoiceViewsFor(form))
const focusAnswer = computed(() => followUpFor(form))
const followUps = computed(() => followUpRecords(form))
const refinements = computed(() => refinementPromptsFor(form))
const refinementId = ref('')
const activeRefinement = computed(() => refinements.value.find(item => item.id === refinementId.value) || refinements.value[0])
function refine(value: string) {
  const item = activeRefinement.value
  if (item && !props.busy) toggleRefinement(form, item.topic, item.parent, value)
}
const freeResponse = computed({
  get: () => focusAnswer.value.note,
  set: value => setFollowUpNote(form, value),
})
const freePlaceholder = computed(() => form.exploration_intent === 'unsure'
  ? '比如，最近反复想到的一件事，或一点好奇'
  : branch.value.placeholder)
const draftInfo = ref(false)
const localError = ref('')
const validationError = ref('')
const validationStep = ref(-1)
watch(() => validationStep.value === 0 ? form.concerns.length > 0 : hasRequiredFollowUp(form), valid => {
  if (valid) { validationError.value = ''; validationStep.value = -1 }
})
const draftSaved = ref(!!cached)
const moving = ref(false)
const direction = ref('forward')
const scrollTop = ref(0)
let navigationTimer: ReturnType<typeof setTimeout> | undefined
const legacyConcerns = [
  { id: 'other', title: '之前留下的其他牵挂', icon: 'message-heart' },
  { id: 'possibility', title: '新的可能', icon: 'door-open' },
]
const mainlineLabels: Record<string, string> = { job_search: '求职', direction: '目前的方向', change: 'AI 与行业变化', choices: '选择与取舍', start: '稳妥地改变', possibility: '新的可能', other: '其他牵挂', unsure: '暂时说不清', relationships: '关系和期待', overload: '生活节奏' }
const selected = computed(() => [...startingConcernOptions, ...legacyConcerns].filter(item => form.concerns.includes(item.id)))
const selectedSummary = computed(() => selected.value.map(item => mainlineLabels[item.id] || item.title).join(' · '))
const contextLabels = computed(() => lifeContexts.filter(item => form.life_contexts?.includes(item.id)))
const contextExpanded = computed(() => contextOpen.value || !activeRefinement.value)
const contextSummary = computed(() => [...contextLabels.value.map(item => item.title), ...form.constraints,
  ...(form.background.trim() ? ['已补充生活情况'] : [])].join(' · ') || '时间、精力等，按需补充')
const support = computed(() => form.support_style ? supportStyles.find(item => item.id === canonicalSupportStyle(form.support_style)) : undefined)
const supportPreviews: Record<string, string> = {
  listen: '从最想说的地方开始，慢慢来就好',
  discover: '从你做过、在意的事情里，找一个新的观察角度',
  compare: '先把选择摆出来，再看看你最想保留什么',
  experiment: '从一个投入不大的尝试开始，看看是否适合现在的你',
}
const supportDetails: Record<string, string> = {
  listen: '先把心里的事说出来', discover: '从已有经历里，看看其他方向',
  compare: '把代价、条件和未知说清楚', experiment: '先试一点点，再决定要不要继续',
}
const branch = computed(() => branchFor(form))
const constraintsText = computed({
  get: () => form.constraints.filter(value => !constraintChoices.includes(value)).join('\n'),
  set: value => { form.constraints = [...new Set([...form.constraints.filter(item => constraintChoices.includes(item)), ...value.split('\n').map(v => v.trim()).filter(Boolean)])].slice(0, 12) },
})
const headings = onboardingHeadings
const heading = computed(() => step.value === 1
  ? { ...explorationIntroFor(form), title: form.exploration_intent && form.exploration_intent !== 'unsure' ? branch.value.heading : explorationIntroFor(form).title,
    detail: '至少选择一项，或写下自己的话' }
  : step.value === 2 && activeRefinement.value
  ? { label: '', title: compactRefinementFor(activeRefinement.value.question), detail: '选填，可以多选，也可以留空继续' }
  : headings[step.value] || headings[0])
// One mounted landscape gives all five questions the same stable visual ground.
const selectedNote = computed(() => step.value === 0
  ? (form.concerns.length ? '已选 ' + form.concerns.length + ' 项 · 下一步，从其中一件事开始' : '还没想好，也可以选「暂时说不清」') : '')
const continueLabel = computed(() => {
  if (step.value === 2 && !refinements.value.some(item => item.answers.length) && !form.life_contexts?.length && !form.constraints.length && !form.background.trim()) return '暂不补充，继续'
  if (step.value === 3 && !form.support_style) return '沿用当前偏好，继续'
  return '继续'
})


function persist() {
  if (applyingRemote) return
  const draft = saveDraft(form, step.value)
  try {
    uni.setStorageSync(draftKey, draft)
    if (JSON.stringify(uni.getStorageSync(draftKey)) !== JSON.stringify(draft)) throw Error('Local write not confirmed')
    draftSaved.value = true; localError.value = ''
  } catch { draftSaved.value = false; localError.value = '本机暂时无法保存草稿，请先不要关闭页面' }
  emit('progress', draft)
}
watch([form, step], persist, { deep: true, flush: 'sync' })
watch(() => props.resume, value => {
  const restored = value && restoreDraft(value)
  if (!restored) return
  applyingRemote = true
  Object.assign(form, newOnboarding(), restored.form)
  step.value = resumeStep(restored.step)
  validationError.value = ''; validationStep.value = -1
  nameOpen.value = !!form.title
  freeOpen.value = !!followUpFor(form).note
  backgroundOpen.value = !!form.background
  constraintsOpen.value = form.constraints.some(item => !constraintChoices.includes(item))
  focusedField.value = ''
  draftSaved.value = true
  scrollTop.value = 1
  void nextTick(() => { scrollTop.value = 0 })
  applyingRemote = false
})
function requireAnswers(target: number) {
  const missing = !form.concerns.length && target > 0 ? 0 : !hasRequiredFollowUp(form) && target > 1 ? 1 : -1
  if (missing < 0) return true
  const changedPage = step.value !== missing
  step.value = missing
  validationStep.value = missing
  validationError.value = missing === 0 ? '请先选择至少一项想聊的事情' : '请至少选择一项，或写下你想聊的具体事情'
  uni.showToast({ title: missing === 0 ? '请先选择想聊的话题' : '请先补充一项具体内容', icon: 'none', duration: 2400 })
  if (changedPage) {
    scrollTop.value = 1
    void nextTick(() => { scrollTop.value = 0 })
  }
  return false
}
function go(value: number) {
  if (moving.value || props.busy || value === step.value) return
  if (value < 0) { emit('skip'); return }
  value = questionStep(value)
  if (!requireAnswers(value)) return
  validationError.value = ''; validationStep.value = -1
  emit('navigate')
  direction.value = value < step.value ? 'backward' : 'forward'
  moving.value = true
  step.value = value
  // The native scroll-view can keep its previous offset across step changes.
  // A 1px -> 0px change is deliberate and resets it on every forward/back move.
  scrollTop.value = 1
  void nextTick(() => { scrollTop.value = 0 })
  // Lock only the short transition, so a second tap cannot skip the next step
  navigationTimer = setTimeout(() => { moving.value = false }, 180)
}
onUnmounted(() => clearTimeout(navigationTimer))
function choose(id: string) {
  if (props.busy) return
  updateConcerns(form, id)
}
function focus(intent: string) {
  if (props.busy) return
  selectMainline(form, intent)
  freeOpen.value = !!followUpFor(form).note
}
function chooseFocus(answer: string) {
  if (props.busy) return
  toggleFollowUp(form, answer)
}
function toggleConstraint(value: string) {
  if (props.busy) return
  form.constraints = form.constraints.includes(value) ? form.constraints.filter(item => item !== value) : [...form.constraints, value].slice(0, 12)
}
function context(id: string) {
  if (props.busy) return
  const values = form.life_contexts || []
  form.life_contexts = values.includes(id) ? values.filter(item => item !== id) : [...values, id]
}
function chooseSupport(id: string) {
  if (!props.busy) form.support_style = id
}
function editAnswer(topic: string) {
  if (props.busy || moving.value) return
  focus(topic)
  freeOpen.value = !!followUpFor(form).note
  go(1)
}
function editRefinement(topic: string, parent: string) {
  if (props.busy || moving.value) return
  refinementId.value = topic + ':' + parent
  go(2)
}
function editContext() {
  contextOpen.value = true
  backgroundOpen.value = !!form.background
  constraintsOpen.value = !!constraintsText.value
  go(2)
}
function submit() {
  if (props.busy) return
  if (!requireAnswers(4)) return
  emit('save', JSON.parse(JSON.stringify(submissionFor(form))))
}
function clearDraft() {
  clearTimeout(navigationTimer)
  applyingRemote = true
  moving.value = false
  Object.assign(form, newOnboarding())
  nameOpen.value = false
  freeOpen.value = false
  contextOpen.value = false
  backgroundOpen.value = false
  constraintsOpen.value = false
  actualQuestionOpen.value = false
  validationError.value = ''; validationStep.value = -1
  refinementId.value = ''
  focusedField.value = ''
  draftInfo.value = false
  step.value = 0
  applyingRemote = false
  persist()
}
defineExpose({ clearDraft })
</script>

<template>
  <view class="onboarding-flow" :class="'question-scene-' + step">
    <view class="question-backdrop" aria-hidden="true">
      <view class="question-images">
        <image :src="resolveAppMedia('/static/opening-dawn.jpg')" mode="aspectFill" />
      </view>
      <view class="question-wash" />
    </view>
    <view key="flow-shell" class="flow-page">
      <view class="flow-chrome">
        <view class="flow-nav"><button class="icon-button flow-back" aria-label="返回上一步" :disabled="busy || moving" hover-class="pressed" :hover-start-time="0" @click="go(step - 1)"><SvgIcon name="back" :size="22" tone="accent" /></button><text class="flow-wordmark">你的空间</text>
          <!-- #ifndef MP-WEIXIN -->
          <button class="icon-button draft-menu" aria-label="草稿与隐私" hover-class="pressed" :hover-start-time="0" @click="draftInfo = true"><SvgIcon name="more" :size="22" tone="accent" /></button>
          <!-- #endif -->
          <!-- #ifdef MP-WEIXIN -->
          <view class="capsule-space" aria-hidden="true" />
          <!-- #endif -->
        </view>
        <ProgressIndicator :current="step + 1" :total="5" accent />
      </view>
      <scroll-view class="flow-scroll" scroll-y enhanced :scroll-top="scrollTop">
        <view class="flow-body" :class="['flow-' + direction + '-' + (step % 2), 'flow-step-' + step]">
          <template v-if="step === 1 && selected.length">
            <view class="question-context"><SvgIcon :name="selected.find(item => item.id === form.exploration_intent)?.icon || 'compass'" :size="16" tone="muted" /><text>你刚才提到的事情</text></view>
            <view class="topic-tabs" role="group" aria-label="选择继续展开的话题">
              <button v-for="item in selected" :key="item.id" class="topic-tab" :class="{ chosen: form.exploration_intent === item.id }"
                :data-mainline="item.id" :aria-pressed="form.exploration_intent === item.id" :disabled="busy" hover-class="pressed" @click="focus(item.id)">{{ mainlineLabels[item.id] || item.title }}</button>
            </view>
          </template>
          <view v-if="step === 2 && activeRefinement" class="context-quote"><SvgIcon name="chat" :size="18" tone="muted" /><view class="context-quote-text"><text class="context-quote-label">你提到的这件事</text><text class="context-quote-copy">{{ activeRefinement.parent }}</text></view></view>
          <view class="flow-heading"><text class="flow-title">{{ heading.title }}</text><text class="flow-description">{{ heading.detail }}</text></view>
          <view v-if="legacyDraft && step === 0" class="legacy-draft">
            <text>这台设备还有之前的回答，要接着整理吗？</text>
            <button class="text-button" @click="recoverLegacyDraft">恢复本机草稿</button>
            <button class="text-button" @click="legacyDraft = null">这次先不使用</button>
          </view>
          <view v-if="step === 0" class="selection-stack">
            <SelectionCard v-for="item in startingConcernOptions" :key="item.id" :title="item.title" :detail="item.detail" :icon="item.icon" inline-icon :selected="form.concerns.includes(item.id)" @select="choose(item.id)" />
          </view>
          <view v-else-if="step === 1" class="exploration-step">
            <view class="exploration-branch">
              <view class="selection-stack exploration-starts" role="group" aria-label="选择目前想理清的事，可多选">
                <SelectionCard v-for="choice in focusViews" :key="choice.value" :data-start="choice.value"
                  :title="choice.title" :detail="choice.detail || undefined" :icon="choice.icon || undefined"
                  layout="row" :selected="focusAnswer.selections.includes(choice.value)" @select="chooseFocus(choice.value)" />
              </view>
              <view class="free-writing">
                <button class="optional-toggle free-writing-toggle" :aria-expanded="freeOpen" :disabled="busy" hover-class="pressed" @click="freeOpen = !freeOpen"><text>{{ form.exploration_intent === 'job_search' ? '目前考虑的方向，或想补充的情况' : '想补充一点自己的话' }}</text><text aria-hidden="true">{{ freeOpen ? '−' : '＋' }}</text></button>
                <view v-show="freeOpen" class="free-field" :class="{ 'is-focused': focusedField === 'free' }">
                  <textarea :key="form.exploration_intent || 'general'" v-model="freeResponse" :disabled="busy" class="text-area flow-textarea free-textarea" maxlength="800"
                    :placeholder="freePlaceholder" placeholder-class="free-placeholder" :auto-height="true"
                    :cursor-spacing="110" :show-confirm-bar="false" aria-label="用自己的话写下此刻的想法"
                    @focus="focusedField = 'free'" @blur="focusedField = ''" />
                </view>
              </view>
              <view v-if="form.actual_question || actualQuestionOpen" class="legacy-question">
                <button class="optional-toggle" :aria-expanded="actualQuestionOpen" :disabled="busy" hover-class="pressed" @click="actualQuestionOpen = !actualQuestionOpen"><text>你之前写下的问题</text><text aria-hidden="true">{{ actualQuestionOpen ? '−' : '＋' }}</text></button>
                <view v-show="actualQuestionOpen" class="free-field"><textarea v-model="form.actual_question" :disabled="busy" class="text-area flow-textarea free-textarea" maxlength="400" :auto-height="true" :cursor-spacing="110" :show-confirm-bar="false" aria-label="修改之前写下的问题" /></view>
              </view>
              <view class="exploration-name">
                <button class="optional-toggle name-toggle" :aria-expanded="nameOpen" @click="nameOpen = !nameOpen" hover-class="pressed">{{ nameOpen ? '收起这次探索的名字' : '给这次探索起个名字（选填）' }}</button>
                <input v-if="nameOpen" v-model="form.title" :disabled="busy" class="text-field exploration-title" maxlength="120" placeholder="可以以后再起名字" />
              </view>
            </view>
          </view>
          <view v-else-if="step === 2" class="context-step">
            <view v-if="activeRefinement" class="refinement-section">
              <text v-if="refinements.length > 1" class="field-label">想先细化哪一个？其他项可以稍后再聊</text>
              <view v-if="refinements.length > 1" class="mainline-stack refinement-tabs">
                <button v-for="item in refinements" :key="item.id" class="mainline-choice" :class="{ chosen: activeRefinement.id === item.id }" :data-refinement="item.id"
                  :aria-pressed="activeRefinement.id === item.id" :disabled="busy" hover-class="pressed" @click="refinementId = item.id">{{ item.parent }}</button>
              </view>
              <view class="selection-stack" role="group" aria-label="进一步说明当前卡点，可多选">
                <SelectionCard v-for="value in activeRefinement.choices" :key="activeRefinement.id + value" :title="value" :data-refine="value"
                  layout="refinement" :selected="activeRefinement.answers.includes(value)" @select="refine(value)" />
              </view>
            </view>
            <view class="optional-context" :class="{ 'is-expanded': contextExpanded }">
              <button v-if="activeRefinement" class="context-toggle" :aria-expanded="contextExpanded" :disabled="busy" hover-class="pressed" @click="contextOpen = !contextOpen"><view><view class="context-toggle-heading"><text>生活状态与现实条件</text><text class="context-optional">选填</text></view><text class="context-summary">{{ contextSummary }}</text></view><text class="disclosure-sign" aria-hidden="true">{{ contextExpanded ? '−' : '＋' }}</text></button>
              <view v-show="contextExpanded" class="context-fields">
            <text class="field-label">最近的生活状态 · 可多选</text>
            <view class="life-contexts" role="group" aria-label="最近的生活状态，可多选">
              <button v-for="item in lifeContexts" :key="item.id" class="life-tag"
                :class="{ chosen: form.life_contexts?.includes(item.id) }"
                :data-context="item.id" :aria-label="item.title" :aria-pressed="!!form.life_contexts?.includes(item.id)"
                :disabled="busy" hover-class="life-tag-pressed" :hover-start-time="0" :hover-stay-time="90"
                @click="context(item.id)">
                <text class="life-tag-label">{{ item.title }}</text>
                <view class="life-tag-check" aria-hidden="true"><view class="life-tag-check-mark" /></view>
              </button>
            </view>
            <view class="context-writing">
              <button class="optional-toggle background-toggle" :aria-expanded="backgroundOpen" :disabled="busy" hover-class="pressed" @click="backgroundOpen = !backgroundOpen"><text>还有想补充的吗？</text><text aria-hidden="true">{{ backgroundOpen ? '−' : '＋' }}</text></button>
              <view v-show="backgroundOpen" class="context-field" :class="{ 'is-focused': focusedField === 'background' }">
                <textarea v-model="form.background" :disabled="busy" class="text-area flow-textarea context-input" maxlength="400"
                  placeholder="比如，正在工作，也想试试新的方向……" placeholder-class="context-placeholder"
                  :auto-height="true" :cursor-spacing="110" :show-confirm-bar="false"
                  @focus="focusedField = 'background'" @blur="focusedField = ''" />
              </view>
              <view class="context-subheading">
                <text class="context-subtitle">想照顾到的现实条件</text>
                <text class="context-optional">可多选</text>
              </view>
              <view class="constraint-choices">
                <button v-for="value in constraintChoices" :key="value" class="mainline-choice" :class="{ chosen: form.constraints.includes(value) }"
                  :aria-pressed="form.constraints.includes(value)" :disabled="busy" hover-class="pressed" @click="toggleConstraint(value)">{{ value }}</button>
              </view>
              <button class="optional-toggle constraints-toggle" :aria-expanded="constraintsOpen" :disabled="busy" hover-class="pressed" @click="constraintsOpen = !constraintsOpen"><text>其他现实条件</text><text aria-hidden="true">{{ constraintsOpen ? '−' : '＋' }}</text></button>
              <view v-show="constraintsOpen" class="context-field" :class="{ 'is-focused': focusedField === 'constraints' }">
                <textarea v-model="constraintsText" :disabled="busy" class="text-area flow-textarea context-input" maxlength="1200"
                  placeholder="其他现实条件，也可以以后聊" placeholder-class="context-placeholder"
                  :auto-height="true" :cursor-spacing="110" :show-confirm-bar="false"
                  @focus="focusedField = 'constraints'" @blur="focusedField = ''" />
              </view>
            </view>
              </view>
            </view>
          </view>
          <view v-else-if="step === 3" class="selection-stack support-choices"><SelectionCard v-for="item in supportStyles" :key="item.id" :title="item.title" :detail="supportDetails[item.id] || item.detail" :icon="item.icon" :preview="supportPreviews[item.id]" layout="support" radio :selected="!!form.support_style && canonicalSupportStyle(form.support_style) === item.id" @select="chooseSupport(item.id)" /></view>
          <view v-else class="reflection-summary">
            <view class="reflection-card reflection-record">
              <view v-if="selected.length" class="reflection-context"><view class="record-label"><text>关注的事情</text><button class="record-edit" :disabled="busy" @click="go(0)" hover-class="pressed">修改</button></view><text class="reflection-copy">{{ selectedSummary }}</text></view>
              <view v-if="form.title" class="reflection-context"><view class="record-label"><text>这次探索的名字</text><button class="record-edit" :disabled="busy" @click="nameOpen = true; go(1)" hover-class="pressed">修改</button></view><text class="reflection-copy">{{ form.title }}</text></view>
              <view v-if="form.actual_question" class="reflection-context"><view class="record-label"><text>你想探索的问题</text><button class="record-edit" :disabled="busy" @click="actualQuestionOpen = true; go(1)" hover-class="pressed">修改</button></view><text class="reflection-copy">{{ form.actual_question }}</text></view>
              <view v-for="answer in followUps" :key="answer.key" class="reflection-context">
                <view class="record-label"><text>{{ followUps.length > 1 ? (mainlineLabels[answer.key] || answer.title) : '想进一步聊的事' }}</text><button class="record-edit" :disabled="busy" @click="editAnswer(answer.key)" hover-class="pressed">修改</button></view>
                <view v-for="value in answer.selections" :key="value" class="record-answer"><text class="reflection-copy">{{ value }}</text><view v-if="answer.refinements?.[value]?.length" class="refinement-record"><view class="record-label"><text>想再展开的部分</text><button class="record-edit edit-refinement" :disabled="busy" @click="editRefinement(answer.key, value)" hover-class="pressed">修改</button></view><text v-for="detail in answer.refinements[value]" :key="detail" class="reflection-copy">{{ detail }}</text></view></view>
                <text v-if="answer.note" class="reflection-copy record-note">{{ answer.note }}</text>
              </view>
              <view v-if="form.focus_response && !followUps.some(answer => answer.note === form.focus_response) && form.focus_response !== form.actual_question" class="reflection-context"><view class="record-label"><text>关于当前主线，你补充的</text><button class="record-edit" :disabled="busy" @click="freeOpen = true; go(1)" hover-class="pressed">修改</button></view><text class="reflection-copy">{{ form.focus_response }}</text></view>
              <view v-if="form.background && form.background !== form.focus_response && form.background !== form.actual_question" class="reflection-context"><view class="record-label"><text>补充的生活情况</text><button class="record-edit" :disabled="busy" @click="editContext()" hover-class="pressed">修改</button></view><text class="reflection-copy">{{ form.background }}</text></view>
              <view v-if="form.constraints.length || contextLabels.length" class="reflection-context"><view class="record-label"><text>也希望照顾到</text><button class="record-edit" :disabled="busy" @click="editContext()" hover-class="pressed">修改</button></view><text v-if="contextLabels.length" class="reflection-copy">{{ contextLabels.map(item => item.title).join(' · ') }}</text><text v-for="line in form.constraints" :key="line" class="reflection-copy">{{ line }}</text></view>
              <view v-if="support" class="reflection-context"><view class="record-label"><text>希望怎样聊</text><button class="record-edit" :disabled="busy" @click="go(3)" hover-class="pressed">修改</button></view><view class="reflection-support"><SvgIcon :name="support.icon" :size="18" tone="accent" /><text>{{ support.title }}</text></view></view>
            </view>
          </view>
        </view>
      <view class="flow-footer">
        <text v-if="selectedNote" class="selection-reassurance">{{ selectedNote }}</text>
        <view v-if="localError || error" class="notice">{{ localError || error }}</view>
        <text v-if="validationError" class="notice validation-message" role="alert" aria-live="polite">{{ validationError }}</text>
        <ActionButton v-if="step < 4" kind="onboarding" stable-press :disabled="busy" :locked="moving" @click="go(step + 1)">{{ continueLabel }}</ActionButton>
        <ActionButton v-else kind="onboarding" stable-press :loading="busy" :locked="moving" @click="submit">带着这些，开始聊聊</ActionButton>
        <view class="flow-footer-detail">
          <button class="flow-skip" :disabled="busy || moving" @click="emit('skip')" hover-class="pressed">稍后再填</button>
          <button class="draft-link" @click="draftInfo = true"><SvgIcon name="lock" :size="12" /><text>{{ syncMessage || (draftSaved ? '本机进度已保留' : '回答会自动保存') }}</text></button>
        </view>
        <view v-if="syncMode === 'conflict'" class="sync-actions">
          <button class="text-button" :disabled="busy" @click="emit('keepLocal')">保留本机进度</button>
          <button class="text-button" :disabled="busy" @click="emit('useRemote')">恢复已同步进度</button>
        </view>
      </view>
      </scroll-view>
    </view>

    <view v-if="draftInfo" class="modal-backdrop" @click.self="draftInfo = false">
      <view class="intro-panel"><view class="modal-handle" /><view class="intro-panel-header"><text class="eyebrow">AGENCY BLOOM</text><button class="icon-button" aria-label="关闭面板" @click="draftInfo = false" hover-class="pressed" :hover-start-time="0" :hover-stay-time="70"><SvgIcon name="close" :size="21" tone="accent" /></button></view>
        <text class="flow-title">随时可以接着填写</text>
        <text class="body-copy">{{ syncMessage || (draftSaved ? '本机进度已保留' : '本机暂时无法保存，请先不要关闭页面') }}</text>
        <text class="body-copy">回答和题目位置会自动保存在本机，联网后同步到你的账号。先跳过也会保留进度；完成确认前，这些草稿不会成为探索卡片，也不会发送给 AI。</text>
        <ActionButton :arrow="false" @click="draftInfo = false">继续探索</ActionButton>
        <button v-if="syncMode === 'local'" class="text-button" @click="emit('retrySync')">重新同步</button>
        <button class="clear-draft" :disabled="busy" @click="clearDraft" hover-class="pressed" :hover-start-time="0" :hover-stay-time="70">重新填写这份问答</button>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss" src="../onboarding-flow.scss"></style>

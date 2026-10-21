<script setup lang="ts">
import { computed, nextTick, onUnmounted, reactive, ref, watch } from 'vue'
import type { Onboarding } from '../domain'
import { startingConcernOptions, focusChoicesFor, focusChoiceViewsFor, explorationIntroFor, concernOptions, lifeContexts, supportStyles, newOnboarding, toggleConcern, reflectionFor, reflectionHeading, saveDraft, restoreDraft, DRAFT_KEY, branchFor, selectMainline, canonicalSupportStyle } from '../onboarding'
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
  nameOpen.value = !!form.title
  persist()
  if (draftSaved.value) {
    try { uni.removeStorageSync(DRAFT_KEY) } catch { /* Keep the original if unavailable. */ }
    legacyDraft.value = null
  }
}
const otherOpen = ref(!!form.actual_question)
const nameOpen = ref(!!form.title)
const focusedField = ref('')
const focusChoices = computed(() => focusChoicesFor(form))
const focusViews = computed(() => focusChoiceViewsFor(form))
const focusIsSuggestion = computed(() => focusChoices.value.includes(form.focus_response || ''))
const freeResponse = computed({
  get: () => focusIsSuggestion.value ? '' : (form.focus_response || ''),
  set: value => { form.focus_response = value },
})
const freePlaceholder = computed(() => form.exploration_intent === 'unsure'
  ? '比如，最近反复想到的一件事，或一点好奇'
  : branch.value.placeholder)
const draftInfo = ref(false)
const localError = ref('')
const draftSaved = ref(!!cached)
const moving = ref(false)
const direction = ref('forward')
const scrollTop = ref(0)
let navigationTimer: ReturnType<typeof setTimeout> | undefined
const legacyConcerns = [
  { id: 'relationships', title: '之前留下的人际关系困扰', icon: 'message-heart' },
  { id: 'overload', title: '之前留下的生活与精力困扰', icon: 'moon' },
]
const selected = computed(() => [...concernOptions, ...legacyConcerns].filter(item => form.concerns.includes(item.id)))
const reflection = computed(() => reflectionFor(form))
const reflectionTitle = computed(() => reflectionHeading(form))
const contextLabels = computed(() => lifeContexts.filter(item => form.life_contexts?.includes(item.id)))
const support = computed(() => form.support_style ? supportStyles.find(item => item.id === canonicalSupportStyle(form.support_style)) : undefined)
const branch = computed(() => branchFor(form))
const constraintsText = computed({ get: () => form.constraints.join('\n'), set: value => { form.constraints = value.split('\n').map(v => v.trim()).filter(Boolean).slice(0, 12) } })
const canContinue = computed(() => step.value === 0 ? form.concerns.length > 0 : step.value === 1 ? !!form.exploration_intent : step.value === 3 ? !!form.support_style : true)
const headings = [
  { label: 'LET’S BEGIN', title: '最近，有什么让你\n感到焦虑、害怕或不安？', detail: '选下最近挂心的事，可多选，也可以带着好奇来' },
  { label: 'A FIRST THREAD', title: '我们先从\n一件小事聊起', detail: '点选就好，暂时没有答案也可以继续' },
  { label: 'ABOUT YOU', title: '你最近的生活，\n主要围绕哪些事？', detail: '选与你有关的，也可以用自己的话补充' },
  { label: 'YOUR STYLE', title: '此刻，你希望\n得到怎样的帮助', detail: '按自己的节奏来，以后也可以改变' },
  { label: 'A BEGINNING', title: '这是一次探索的起点\n而不是对你的定义', detail: '根据固定问题整理，还没有使用 AI' },
]
const heading = computed(() => step.value === 1 ? explorationIntroFor(form) : headings[step.value] || headings[0])
const scenes = ['water', 'path', 'rest', 'meadow', 'dawn']
const scene = computed(() => '/static/opening-' + scenes[step.value] + '.jpg')
const contextStatus = computed(() => {
  const count = form.life_contexts?.length || 0
  return count ? '已选 ' + count + ' 项 · 之后也可以再调整' : '之后也可以再调整'
})
const selectedNote = computed(() => step.value === 0
  ? (form.concerns.length ? '已选 ' + form.concerns.length + ' 项 · 都可以慢慢聊' : '没有标准答案，选接近你的就好')
  : step.value === 1 ? '不确定也没关系，可以直接继续'
  : step.value === 2 ? '' : '你的选择，之后仍然可以改变')


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
  const wasQuickAnswer = focusChoices.value.includes(form.focus_response || '')
  form.concerns = toggleConcern(form.concerns, id)
  if (!form.concerns.includes(form.exploration_intent || '')) {
    if (wasQuickAnswer) form.focus_response = ''
    form.exploration_intent = form.concerns.length === 1 ? form.concerns[0] : ''
  }
}
function focus(intent: string) {
  selectMainline(form, intent)
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
  nameOpen.value = false
  focusedField.value = ''
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
      <scroll-view class="flow-scroll" scroll-y :scroll-top="scrollTop" :show-scrollbar="false">
        <view :key="'content-' + step" class="flow-body" :class="['flow-' + direction + '-' + (step % 2), 'flow-step-' + step]">
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
          <view v-else-if="step === 1" class="exploration-step">
            <template v-if="selected.length > 1">
              <text class="field-label exploration-field-label">先聊哪一个方向</text>
              <view class="selection-stack mainline-stack">
                <SelectionCard v-for="item in selected" :key="item.id" :title="item.title" :icon="item.icon" radio :selected="form.exploration_intent === item.id" @select="focus(item.id)" />
              </view>
            </template>
            <view v-if="form.exploration_intent" class="exploration-branch">
              <text v-if="form.exploration_intent !== 'unsure'" class="branch-question">{{ branch.question }}</text>
              <view class="selection-stack exploration-starts" role="group" aria-label="选择一个探索起点">
                <SelectionCard v-for="choice in focusViews" :key="choice.value" :data-start="choice.value"
                  :title="choice.title" :detail="choice.detail || undefined" :icon="choice.icon || undefined"
                  :selected="form.focus_response === choice.value" @select="chooseFocus(choice.value)" />
              </view>
              <view class="free-writing">
                <text class="free-writing-title">或者，用自己的话说</text>
                <view class="free-field" :class="{ 'is-focused': focusedField === 'free' }">
                  <textarea v-model="freeResponse" class="text-area flow-textarea free-textarea" maxlength="800"
                    :placeholder="freePlaceholder" placeholder-class="free-placeholder" :auto-height="true"
                    :cursor-spacing="110" :show-confirm-bar="false" aria-label="用自己的话写下此刻的想法"
                    @focus="focusedField = 'free'" @blur="focusedField = ''" />
                </view>
              </view>
              <view class="exploration-name">
                <button class="optional-toggle name-toggle" :aria-expanded="nameOpen" @click="nameOpen = !nameOpen" hover-class="pressed">{{ nameOpen ? '收起这次探索的名字' : '给这次探索起个名字（选填）' }}</button>
                <input v-if="nameOpen" v-model="form.title" class="text-field exploration-title" maxlength="120" placeholder="可以以后再起名字" />
              </view>
            </view>
          </view>
          <view v-else-if="step === 2" class="context-step">
            <view class="life-contexts" role="group" aria-label="最近的生活状态，可多选">
              <button v-for="item in lifeContexts" :key="item.id" class="life-tag"
                :class="{ chosen: form.life_contexts?.includes(item.id) }"
                :data-context="item.id" :aria-label="item.title" :aria-pressed="!!form.life_contexts?.includes(item.id)"
                :disabled="busy || moving" hover-class="life-tag-pressed" :hover-start-time="0" :hover-stay-time="90"
                @click="context(item.id)">
                <text class="life-tag-label">{{ item.title }}</text>
                <view class="life-tag-check" aria-hidden="true"><view class="life-tag-check-mark" /></view>
              </button>
            </view>
            <text class="context-status" role="status" aria-live="polite">{{ contextStatus }}</text>
            <view class="context-writing">
              <view class="context-writing-heading">
                <text class="context-writing-title">还有想补充的吗？</text>
                <text class="context-optional">选填</text>
              </view>
              <view class="context-field" :class="{ 'is-focused': focusedField === 'background' }">
                <textarea v-model="form.background" class="text-area flow-textarea context-input" maxlength="400"
                  placeholder="比如，正在工作，也想试试新的方向……" placeholder-class="context-placeholder"
                  :auto-height="true" :cursor-spacing="110" :show-confirm-bar="false"
                  @focus="focusedField = 'background'" @blur="focusedField = ''" />
              </view>
              <view class="context-subheading">
                <text class="context-subtitle">想照顾到的现实条件</text>
                <text class="context-optional">选填</text>
              </view>
              <view class="context-field" :class="{ 'is-focused': focusedField === 'constraints' }">
                <textarea v-model="constraintsText" class="text-area flow-textarea context-input" maxlength="1200"
                  placeholder="比如时间、收入或精力，也可以以后聊" placeholder-class="context-placeholder"
                  :auto-height="true" :cursor-spacing="110" :show-confirm-bar="false"
                  @focus="focusedField = 'constraints'" @blur="focusedField = ''" />
              </view>
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
        <text v-if="step < 4 && step !== 2" class="selection-reassurance">{{ selectedNote }}</text>
        <view v-if="localError || error" class="notice">{{ localError || error }}</view>
        <ActionButton v-if="step < 4" kind="quiet" :disabled="!canContinue" :locked="moving" @click="go(step + 1)">继续</ActionButton>
        <ActionButton v-else kind="quiet" :loading="busy" :locked="moving" @click="submit">保存这次探索</ActionButton>
        <view class="flow-footer-detail">
          <button class="flow-skip" :disabled="busy || moving" @click="emit('skip')" hover-class="pressed">稍后再说，先进入空间</button>
          <button class="draft-link" @click="draftInfo = true"><SvgIcon name="lock" :size="12" /><text>{{ draftSaved ? '本机草稿已保留' : '回答暂不上传' }}</text></button>
        </view>
      </view>
    </view>

    <view v-if="draftInfo" class="modal-backdrop" @click.self="draftInfo = false">
      <view class="intro-panel"><view class="modal-handle" /><view class="intro-panel-header"><text class="eyebrow">AGENCY BLOOM</text><button class="icon-button" aria-label="关闭面板" @click="draftInfo = false" hover-class="pressed" :hover-start-time="0" :hover-stay-time="70"><SvgIcon name="close" :size="21" /></button></view>
        <template><text class="flow-title">{{ draftSaved ? '草稿已留在这台设备' : '先保留页面里的想法' }}</text><text class="body-copy">{{ draftSaved ? '已核对本机草稿，7 天内可以回来接着探索' : '本机草稿尚未保存，请先不要关闭页面' }}</text><text class="body-copy">{{ '点击「保存这次探索」前，不会上传你的回答\n如果正在使用共用设备，可以随时清除本机草稿' }}</text><ActionButton :arrow="false" @click="draftInfo = false">继续探索</ActionButton><button class="clear-draft" @click="clearDraft" hover-class="pressed" :hover-start-time="0" :hover-stay-time="70">清除本机草稿</button></template>
      </view>
    </view>
  </view>
</template>

<style scoped>
/* Quiet onboarding surfaces are theme tokens, never a fixed green or blue. */
.optional-toggle {
  display:block; margin:12px 0 0; padding:12px 0; min-height:44px; text-align:left;
  color:var(--muted); background:transparent; font-size:13px; line-height:1.8;
}
.optional-toggle::after { border:0; }
.legacy-draft {
  padding:16px; margin-bottom:20px; background:var(--quiet-surface); border:1px solid var(--quiet-border);
  border-radius:14px; box-shadow:var(--quiet-shadow); font-size:13px; line-height:1.8;
}
.flow-footer-detail { flex-wrap:wrap; gap:4px 12px; }

/* The imagery stays behind readable choices and follows the active theme wash. */
.onboarding-flow { isolation:isolate; background:var(--bg); }
.question-backdrop { position:absolute; inset:0; z-index:0; pointer-events:none; overflow:hidden; }
.question-backdrop > image { position:absolute; width:100%; height:100%; opacity:var(--onboarding-image-opacity,.62); }
.question-wash {
  position:absolute; inset:0;
  background:linear-gradient(180deg,var(--onboarding-wash-top),var(--onboarding-wash-mid) 42%,var(--onboarding-wash-bottom));
}
.question-scene-1 .question-wash { background:linear-gradient(180deg,var(--onboarding-wash-top),var(--onboarding-wash-mid) 34%,var(--onboarding-wash-bottom)); }
.question-scene-2 .question-backdrop > image { opacity:var(--onboarding-image-opacity,.62); }
.question-scene-2 .question-wash { background:linear-gradient(180deg,var(--onboarding-wash-top) 0%,var(--onboarding-wash-mid) 52%,var(--bg) 100%); }
.flow-page { position:relative; z-index:1; background:transparent; }
.flow-chrome { padding-top:calc(var(--capsule-bottom,64px) + 12px); }
.flow-nav { margin-bottom:14px; }
.flow-wordmark { color:var(--muted); }
.flow-body { padding-top:22px; }
.flow-heading { position:relative; padding-bottom:8px; }
.flow-heading .eyebrow { color:var(--muted); letter-spacing:2.2px; }
.flow-heading .flow-title {
  font-family:var(--font-heading); font-size:24px; font-weight:500; line-height:1.5;
  letter-spacing:.5px; color:var(--ink);
}
.flow-heading .flow-description { color:var(--muted); font-size:13px; line-height:1.9; max-width:100%; margin-top:12px; margin-bottom:24px; }
.flow-step-2 .flow-heading .eyebrow { color:var(--accent); }
.flow-step-2 .flow-heading .flow-title { color:var(--ink); }
.flow-step-2 .flow-heading .flow-description { color:var(--muted); }
.selection-stack { gap:12px; }
.flow-footer { background:var(--nav-glass); border-top:1px solid var(--line); padding-top:10px; box-shadow:none; }
.selection-reassurance { display:block; text-align:center; color:var(--muted); font-size:11px; line-height:1.8; margin:0 0 9px; }
.flow-footer :deep(.action-button) { border-radius:16px; }
.flow-footer-detail { justify-content:space-between; }
.flow-footer .flow-skip { color:var(--ink); font-size:12px; }
.flow-footer .draft-link { font-size:10px; }
:deep(.progress-track) { height:3px; background:var(--line); }
:deep(.progress-fill) { background:var(--accent); }
:deep(.progress-count) { color:var(--muted); }
.flow-step-1 .flow-heading .flow-description { margin-bottom:22px; }
.exploration-step { padding-bottom:10px; }
.exploration-field-label { margin:0 0 11px; }
.mainline-stack { margin-bottom:24px; }
.exploration-branch { display:flex; flex-direction:column; }
.branch-question {
  display:block; margin:0 0 14px; color:var(--ink);
  font-family:var(--font-heading); font-size:17px; line-height:1.72;
}
.exploration-starts { gap:11px; }
.free-writing { margin-top:24px; }
.free-writing-title {
  display:block; margin-bottom:9px; color:var(--ink);
  font-size:13px; font-weight:500; line-height:1.8; letter-spacing:.1px;
}
.free-field {
  border:1px solid var(--quiet-border); border-radius:14px; background:var(--quiet-surface);
  box-shadow:var(--quiet-shadow); overflow:hidden;
  transition:border-color 160ms var(--ease-out),box-shadow 160ms var(--ease-out);
}
.free-field.is-focused { border-color:var(--quiet-border-selected); box-shadow:0 0 0 3px var(--tag-focus-ring); }
.free-textarea {
  display:block; width:100%; min-height:96px; margin:0; padding:14px 15px;
  border:0; background:transparent; color:var(--quiet-title);
  font-size:13.5px; line-height:1.9;
}
.free-placeholder { color:var(--quiet-detail); opacity:1; }
.exploration-name { margin-top:2px; }
.name-toggle { margin:0; padding:10px 0; font-size:12px; min-height:44px; }
.exploration-title {
  margin:2px 0 10px; min-height:48px; border-radius:14px;
  border-color:var(--quiet-border); background:var(--quiet-surface); color:var(--quiet-title);
}
.question-scene-2 .flow-chrome, .question-scene-2 .flow-footer { padding-left:22px; padding-right:22px; }
.flow-body.flow-step-2 { padding-left:22px; padding-right:22px; }
.flow-body.flow-step-2 { animation:context-enter 240ms var(--ease-out) both; }
@keyframes context-enter { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:translateY(0); } }
.context-step { padding-bottom:6px; }
.life-contexts { display:flex; flex-wrap:wrap; align-items:flex-start; gap:11px 10px; width:100%; }
.life-tag { position:relative; display:inline-flex; align-items:center; flex:0 0 auto; min-height:50px; box-sizing:border-box; margin:0; padding:10px 37px 10px 16px; border:1px solid var(--tag-border); border-radius:999px; background:var(--tag-surface); box-shadow:var(--tag-shadow); color:var(--tag-ink); font-size:14px; font-weight:500; line-height:1.5; letter-spacing:.1px; text-align:left; white-space:nowrap; transition:background-color 160ms var(--ease-out),border-color 160ms var(--ease-out),box-shadow 100ms var(--ease-out),transform 100ms var(--ease-out); touch-action:manipulation; }
.life-tag::after { border:0; }
.life-tag-label { display:block; }
.life-tag-check { position:absolute; top:50%; right:13px; width:17px; height:17px; margin-top:-9px; display:flex; align-items:center; justify-content:center; border-radius:50%; background:var(--tag-check-bg); color:var(--tag-check-ink); opacity:0; transform:scale(.68); transition:opacity 160ms var(--ease-out),transform 180ms var(--ease-out); }
.life-tag-check-mark { width:4px; height:7px; margin-top:-1px; border-right:1.5px solid currentColor; border-bottom:1.5px solid currentColor; transform:rotate(45deg); }
.life-tag.chosen { background:var(--tag-surface-selected); border-color:var(--tag-border-selected); box-shadow:inset 0 0 0 1px var(--tag-border-selected),var(--tag-shadow); }
.life-tag.chosen .life-tag-check { opacity:1; transform:scale(1); }
.life-tag.life-tag-pressed { transform:scale(.98); background:var(--tag-surface-pressed); border-color:var(--tag-border-pressed); }
.life-tag.chosen.life-tag-pressed { background:var(--tag-surface-selected); border-color:var(--tag-border-selected); box-shadow:inset 0 0 0 1px var(--tag-border-selected),0 0 0 3px var(--tag-focus-ring); }
.context-status { display:block; min-height:22px; margin:15px 0 30px; color:var(--muted); font-size:12px; line-height:1.8; letter-spacing:.1px; }
.context-writing { margin:0; padding:0; }
.context-writing-heading { display:flex; align-items:baseline; gap:8px; margin-bottom:12px; }
.context-writing-title { color:var(--ink); font-size:15px; font-weight:500; line-height:1.6; }
.context-optional { color:var(--muted); font-size:11px; font-weight:400; line-height:1.6; }
.context-subheading { display:flex; align-items:baseline; gap:8px; margin:20px 0 9px; }
.context-subtitle { color:var(--ink); font-size:12px; font-weight:500; line-height:1.6; }
.context-field { border-radius:14px; }
.context-field .context-input { display:block; width:100%; min-height:104px; margin:0; padding:15px 16px; border:1px solid var(--tag-border); border-radius:14px; background:var(--tag-surface); color:var(--tag-ink); font-size:14px; line-height:1.8; box-shadow:none; transition:border-color 160ms var(--ease-out),box-shadow 160ms var(--ease-out),background-color 160ms var(--ease-out); }
.context-field.is-focused .context-input { border-color:var(--tag-border-selected); box-shadow:0 0 0 3px var(--tag-focus-ring); background:var(--tag-surface); }
.context-writing .context-field:last-child .context-input { min-height:96px; }
@media(max-width:360px) {
  .question-scene-2 .flow-chrome, .question-scene-2 .flow-footer, .flow-body.flow-step-2 { padding-left:20px; padding-right:20px; }
  .life-contexts { gap:10px; }
  .life-tag { min-height:48px; padding:9px 35px 9px 15px; font-size:14px; }
  .life-tag-check { right:12px; }
  .context-status { margin-bottom:26px; }
}
@media(prefers-reduced-motion:reduce) {
  .flow-body.flow-step-2 { animation:none; }
  .life-tag, .life-tag-check, .context-field .context-input { transition:none; }
  .life-tag.life-tag-pressed, .life-tag.chosen .life-tag-check { transform:none; }
}
.reflection-card { background:var(--quiet-surface); border:1px solid var(--quiet-border); border-radius:18px; box-shadow:var(--quiet-shadow); }
.reflection-next { border-top:1px solid var(--quiet-border); }
.optional-writing { border:1px solid var(--quiet-border); border-radius:14px; padding:0 12px; background:var(--quiet-surface); }
@media(max-width:360px) {
  .flow-heading .flow-title { font-size:22px; }
  .flow-chrome,.flow-body,.flow-footer { padding-left:20px; padding-right:20px; }
}
@media(prefers-reduced-motion:reduce) {
  .question-backdrop > image { transition:none; }
  .free-field, .free-textarea { transition:none; }
}
</style>
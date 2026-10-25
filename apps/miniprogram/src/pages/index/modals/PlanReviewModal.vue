<script setup lang="ts">
import ModalShell from './ModalShell.vue'
import type { PlanEditor } from '../../../use-plan'
import type { PlanDraft, PlanState } from '../../../domain'
defineOptions({ options: { styleIsolation: 'apply-shared' } })
defineProps<{ editor: PlanEditor; busy: boolean; error: string; latest: PlanState | null; incoming: { draft: PlanDraft } | null; memoryUseEnabled?: boolean }>()
const emit = defineEmits<{ close: []; save: []; refine: []; adopt: []; keep: []; reload: []; memories: [] }>()
</script>
<template>
  <ModalShell title="这份内容，由你来定" :busy="busy" :error="error" @close="emit('close')">
    <text class="body-copy">{{ editor.status ? '可以补充这次经历；确认保存后才会改变这一步的状态' : '直接修改文字，或请 Bloom 再整理一版；确认保存后才会更新 Plan' }}</text>
    <view v-if="incoming" class="plan-review-revision">
      <text class="field-label">Bloom 新整理的一版</text>
      <text class="body-copy">{{ incoming.draft.title }}</text><text class="plan-review-copy">{{ incoming.draft.text }}</text>
      <text v-if="incoming.draft.next_step" class="plan-review-copy">下一步：{{ incoming.draft.next_step }}</text>
      <view class="plan-review-actions"><button class="text-button" :disabled="busy" @click="emit('adopt')">采用这版，再自己改</button><button class="text-button" :disabled="busy" @click="emit('keep')">保留我的版本</button></view>
    </view>
    <button class="plan-review-toggle" :class="{ 'is-checked': editor.includeRecord }" :disabled="busy" role="checkbox" :aria-checked="editor.includeRecord" @click="editor.includeRecord = !editor.includeRecord" hover-class="pressed" :hover-start-time="0"><view class="plan-check" aria-hidden="true"><view class="plan-check-mark" /></view><text>{{ editor.recordId ? '保存对这条记录的修改' : '保存一条记录' }}</text></button>
    <view v-if="editor.includeRecord">
      <text class="field-label">记录标题</text><input v-model="editor.title" class="text-field" :disabled="busy || editor.recordId?.startsWith('feedback:')" maxlength="120" />
      <text class="field-label">我想留下的内容</text><textarea v-model="editor.text" class="text-area" :disabled="busy" maxlength="2000" :auto-height="true" placeholder="发生了什么？哪些还没决定？" />
    </view>
    <button v-if="!editor.status" class="plan-review-toggle" :class="{ 'is-checked': editor.includeStep }" :disabled="busy" role="checkbox" :aria-checked="editor.includeStep" @click="editor.includeStep = !editor.includeStep" hover-class="pressed" :hover-start-time="0"><view class="plan-check" aria-hidden="true"><view class="plan-check-mark" /></view><text>{{ editor.includeRecord ? '同时更新下一步' : '更新下一步' }}</text></button>
    <view v-if="editor.includeStep && !editor.status">
      <view v-if="editor.baseStep && latest?.status !== 'completed'" class="plan-step-choice">
        <button :class="{ selected: editor.stepAction === 'revise' }" :aria-pressed="editor.stepAction === 'revise'" :disabled="busy" @click="editor.stepAction = 'revise'">调整这一步</button>
        <button :class="{ selected: editor.stepAction === 'replace' }" :aria-pressed="editor.stepAction === 'replace'" :disabled="busy" @click="editor.stepAction = 'replace'">换成新的尝试</button>
      </view>
      <text class="field-label">{{ editor.stepAction === 'replace' ? '我想开始的新尝试' : '我愿意尝试的下一步' }}</text><textarea v-model="editor.nextStep" class="text-area compact" :disabled="busy" maxlength="600" :auto-height="true" placeholder="写具体想试的事，不必一次想完整" />
      <text class="muted small">{{ editor.stepAction === 'replace' ? '原来的尝试和经历会保留在回顾里；还没想好新的一步，也可以留空后确认' : '修改文字会保留这一步的状态与进展；清空后保存只移除这一步' }}</text>
      <view v-if="latest && latest.next_step !== editor.nextStep"><text class="field-label">当前已保存的下一步</text><text class="plan-review-copy">{{ latest.next_step || '尚未选择下一步' }}</text></view>
    </view>
    <text v-if="editor.status" class="body-copy">本次会将这一步设为：{{ editor.status === 'paused' ? '先放一放' : editor.status === 'completed' ? '已完成，下一步待决定' : '继续尝试' }}，不会结束整个探索</text>
    <view class="plan-memory-review">
      <button class="plan-review-toggle plan-memory-toggle" :class="{ 'is-checked': editor.rememberPlan }" :disabled="busy" role="checkbox" :aria-checked="editor.rememberPlan" @click="editor.rememberPlan = !editor.rememberPlan" hover-class="pressed" :hover-start-time="0"><view class="plan-check" aria-hidden="true"><view class="plan-check-mark" /></view><text>同步到这段探索的长期记忆</text></button>
      <text class="muted small">{{ editor.rememberPlan ? '确认后，完成、暂停和更换尝试等后续变化也会同步；可随时取消' : '只更新 Plan；已有的同步记忆会停用，内容仍可管理' }}</text>
      <text v-if="editor.rememberPlan && !memoryUseEnabled" class="muted small">记忆使用目前已关闭，保存不会自动开启；这段探索的对话仍会带上最新 Plan</text>
      <button class="text-button" :disabled="busy" @click="emit('memories')">管理长期记忆</button>
    </view>
    <view v-if="error">
      <button class="text-button" :disabled="busy" @click="emit('reload')">读取最新内容，保留我的编辑</button>
    </view>
    <view v-if="editor.recordId && latest && latest.records.find(r => r.id === editor.recordId)?.text !== editor.text"><text class="field-label">当前已保存的记录</text><text class="plan-review-copy">{{ latest.records.find(r => r.id === editor.recordId)?.text || '原记录已不可用' }}</text></view>
    <button class="primary" :disabled="busy || !!incoming" :loading="busy" @click="emit('save')">{{ editor.status ? '保存并确认状态' : editor.includeRecord && editor.includeStep ? '保存记录，并更新下一步' : editor.includeRecord ? '只保存这条记录' : '确认保存' }}</button>
    <view v-if="!editor.status" class="plan-review-refine">
      <text class="field-label">想让 Bloom 再怎么改？</text><textarea v-model="editor.instruction" class="text-area compact" :disabled="busy" maxlength="500" :auto-height="true" placeholder="比如：更简短一点，保留我还没决定的语气" />
      <button class="secondary" :disabled="busy" @click="emit('refine')">带着当前版本，请 Bloom 再改</button>
      <text class="muted small">先进入对话草稿，由你发送；我的版本会保留，新版可比较后再采用</text>
    </view>
    <button class="text-button wide" :disabled="busy" @click="emit('close')">暂不保存，保留草稿</button>
  </ModalShell>
</template>
<style scoped>
.plan-review-toggle { display:flex; align-items:center; gap:11px; min-height:48px; width:100%; margin:14px 0 8px; padding:10px 12px; box-sizing:border-box; background:var(--soft); border:1px solid var(--line); color:var(--ink); font-size:14px; line-height:1.6; text-align:left; border-radius:8px; touch-action:manipulation; }
.plan-review-toggle::after { border:0; }
.plan-check { display:flex; align-items:center; justify-content:center; flex-shrink:0; width:22px; height:22px; box-sizing:border-box; border:1.5px solid var(--muted); border-radius:6px; background:var(--paper); }
.is-checked .plan-check { background:var(--accent); border-color:var(--accent); }
.plan-check-mark { visibility:hidden; width:6px; height:10px; margin-top:-3px; border-right:2px solid var(--paper); border-bottom:2px solid var(--paper); transform:rotate(45deg); }
.is-checked .plan-check-mark { visibility:visible; }
.plan-review-toggle[disabled] { opacity:.6; }
.plan-step-choice { display:flex; gap:8px; margin:8px 0 14px; }
.plan-step-choice button { flex:1; min-height:44px; margin:0; padding:10px 6px; color:var(--muted); background:transparent; border:1px solid var(--line); border-radius:6px; font-size:13px; line-height:1.6; }
.plan-step-choice button::after { border:0; }
.plan-step-choice .selected { background:var(--accent-light); color:var(--ink); border-color:var(--accent); }
.plan-review-copy { display:block; font-size:14px; line-height:1.75; white-space:pre-wrap; overflow-wrap:anywhere; color:var(--ink); margin:8px 0; }
.plan-review-revision { padding:14px; margin:14px 0; background:var(--soft); border:1px solid var(--line); border-radius:8px; }
.plan-review-actions { display:flex; flex-wrap:wrap; gap:10px; }
.plan-review-refine { border-top:1px solid var(--line); padding-top:12px; margin-top:20px; }
.plan-memory-review { margin:18px 0; }
.plan-memory-review .small { display:block; margin-top:7px; line-height:1.7; }
.plan-memory-review .text-button { margin-top:6px; }
</style>

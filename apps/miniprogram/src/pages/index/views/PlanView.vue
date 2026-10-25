<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import SvgIcon from '../../../components/SvgIcon.vue'
import PlanAtmosphere from '../../../components/PlanAtmosphere.vue'
import type { Card, Issue, PlanState, PlanRecord } from '../../../domain'
import { editFields, prettyDate } from '../data'
import { discoveryTitle } from '../../../discover-angles'

defineOptions({ options: { styleIsolation: 'apply-shared' } })
const props = defineProps<{ current: Issue; card: Card; themeId: string; planState?: PlanState | null; planError?: string; planLoading?: boolean }>()
const emit = defineEmits<{ openEditor: []; step: []; next: []; direction: []; pause: []; feedback: []; chat: [concern?: string]; recordChat: []; editRecord: [record: PlanRecord]; status: [value: 'active' | 'completed']; retry: []; switch: []; resume: []; end: [] }>()
const status = computed(() => props.planState?.status || (props.card.next_step ? 'active' : 'empty'))
const invitation = computed(() => status.value === 'paused' ? '想继续时，再一起看看' : status.value === 'completed' ? '这次之后，有什么新想法？' : props.planState?.latest ? '根据这次经历，调整一下？' : props.card.next_step ? '后来怎么样了？和我说说' : '最近，什么让你为难？')
const stepExpanded = ref(false)
const expanded = ref(false)
const concern = ref('')
const asking = ref(false)
const selectedObservation = ref('')
const fields = computed(() => editFields.filter(field => props.card[field.key].length))
const recent = computed(() => props.planState?.records.filter(r => r.id !== props.planState?.latest?.id && r.kind !== 'decision').slice(0, 3) || [...props.current.feedback].sort((a,b) => b.created_at.localeCompare(a.created_at)).slice(0,3).map(r => ({ ...r, id: 'feedback:' + r.id, title: '你留下的经历', version: '', attempt_id: null, editable: false })))
watch(() => props.current.id, () => { expanded.value = false; stepExpanded.value = false; concern.value = ''; asking.value = false; selectedObservation.value = '' })
function chat(text = concern.value) { if (!props.current.ended_at) emit('chat', text) }
function journey() { uni.navigateTo({ url: '/pages/journey/index?theme=' + props.themeId + '&issue=' + encodeURIComponent(props.current.id) }) }
function onInput(event: Event) { concern.value = (event as CustomEvent<{ value: string }>).detail.value }
</script>

<template>
  <view class="workspace plan-content bloom-content plan-journal">
    <PlanAtmosphere />
    <view class="plan-foreground">
      <view class="plan-focus">
        <view class="plan-focus-copy"><text class="plan-caption">围绕这件事</text><text class="plan-focus-title">{{ discoveryTitle(current) }}</text></view>
        <button class="plan-link" @click="emit('switch')" hover-class="pressed" :hover-start-time="0">切换</button>
      </view>
      <view class="plan-intro">
        <text class="plan-heading">为下一步，留一点空间</text>
        <text class="plan-subtitle">从眼前的难处出发，试一点，再看看</text>
      </view>
      <view class="plan-attempt">
        <view v-if="!current.ended_at" class="plan-companion">
          <button class="plan-bubble" @click="asking = !asking" :aria-expanded="asking" hover-class="pressed" :hover-start-time="0">{{ invitation }}</button>
          <button class="plan-bot" aria-label="和 Bloom 一起想下一步" @click="asking = !asking" hover-class="plan-bot-pressed" :hover-start-time="0"><image src="/static/bloom-home-top.png" mode="aspectFit" aria-hidden="true" /></button>
        </view>
        <view class="plan-card-top"><text class="plan-caption">{{ current.ended_at ? '已结束的探索 · 留下的下一步' : status === 'paused' ? '已先放一放 · 原来的尝试仍在' : status === 'completed' ? '这一步已完成 · 下一步待决定' : '我愿意尝试的下一步' }}</text><SvgIcon name="leaf" :size="18" tone="accent" /></view>
        <text class="plan-attempt-title" :class="{ 'plan-step-collapsed': !stepExpanded }">{{ card.next_step || '还没有决定，也没关系' }}</text>
        <button v-if="card.next_step.length > 60 || card.next_step.split('\n').length > 4" class="plan-link" :aria-expanded="stepExpanded" @click="stepExpanded = !stepExpanded">{{ stepExpanded ? '收起全文' : '查看完整内容' }}</button>
        <text v-if="!card.next_step" class="plan-subtitle">可以先和 Bloom 聊聊眼前的困扰，也可以自己留下一步</text>
        <view v-if="planState?.latest" class="plan-latest"><text class="plan-caption">关于这一步 · {{ prettyDate(planState.latest.created_at) }}</text><button class="plan-record-text" :class="{ 'plan-record-collapsed': selectedObservation !== planState.latest.id }" :aria-expanded="selectedObservation === planState.latest.id" @click="selectedObservation = selectedObservation === planState.latest.id ? '' : planState.latest.id">{{ planState.latest.text }}</button><button v-if="!current.ended_at" class="plan-link" @click="emit('editRecord', planState.latest)">编辑这次记录</button></view>
        <text v-if="planLoading" class="plan-caption">正在读取最新记录</text>
        <view v-if="planError"><text class="plan-caption">{{ planError }}</text><button class="plan-link" @click="emit('retry')">重新读取</button></view>
        <view v-if="!current.ended_at" class="plan-actions">
          <button v-if="status === 'completed'" class="plan-primary" @click="chat('这一步已经完成了，我想回顾这次经历，再一起想想下一步。先不默认继续原来的做法')" hover-class="pressed" :hover-start-time="0">和 Bloom 想想下一步 <SvgIcon name="chat" :size="16" /></button>
          <button v-else-if="status === 'paused'" class="plan-primary" @click="emit('status', 'active')" hover-class="pressed" :hover-start-time="0">继续这一步 <SvgIcon name="step" :size="16" /></button>
          <button v-else-if="card.next_step" class="plan-primary" @click="emit('recordChat')" hover-class="pressed" :hover-start-time="0">记录新进展 <SvgIcon name="chat" :size="16" /></button>
          <button v-else class="plan-primary" @click="asking = !asking" :aria-expanded="asking" hover-class="pressed" :hover-start-time="0">和 Bloom 想一想 <SvgIcon name="chat" :size="17" /></button>
          <button v-if="status === 'completed'" class="plan-link" @click="emit('next')" hover-class="pressed" :hover-start-time="0">自己写下一步</button>
          <button v-else class="plan-link" @click="emit('step')" hover-class="pressed" :hover-start-time="0">{{ card.next_step ? '调整这一步' : '自己留下一步' }}</button>
        </view>
        <view v-if="card.next_step && !current.ended_at" class="plan-state-actions">
          <button class="plan-link" @click="emit('feedback')">{{ status === 'completed' ? '补充这次经历' : '自己写记录' }}</button>
          <button v-if="status === 'active'" class="plan-link" @click="emit('pause')">先放一放</button>
          <button v-if="status !== 'completed'" class="plan-link" @click="emit('status', 'completed')">这一步做完了</button>
          <button v-else class="plan-link" @click="emit('status', 'active')">还没完成，继续</button>
          <button class="plan-link" @click="emit('direction')">换个方向</button>
        </view>
        <view v-if="asking && !current.ended_at" class="plan-conversation">
          <text class="plan-input-label">此刻，最想解决什么？</text>
          <textarea class="plan-input" :value="concern" @input="onInput" maxlength="1200" placeholder="比如：想换个方向，但不能中断收入" :auto-height="true" />
          <text class="plan-caption">可以说说具体难处、想改变什么，以及现在能投入多少；也可以直接去聊</text>
          <button class="plan-primary" @click="chat()" hover-class="pressed" :hover-start-time="0">带到对话里，一起想 <SvgIcon name="arrow" :size="16" /></button>
          <text class="plan-caption plan-transfer-note">接着相关对话聊 · 有未发送内容时另开一段<br />整理成草稿后，可自己修改，再确认加入 Plan</text>
        </view>
      </view>
      <view v-if="recent.length || !planState?.latest" class="plan-section-heading"><text>{{ planState?.latest ? '之前留下的记录' : '留下的记录' }}</text><button v-if="!current.ended_at" class="plan-link" @click="emit('feedback')" hover-class="pressed" :hover-start-time="0">记下一点 <SvgIcon name="plus" :size="14" /></button></view>
      <text v-if="!recent.length && !planState?.latest" class="plan-empty-note">没有行动、有点疲惫，或改变了主意，也可以记在这里</text>
      <view v-for="entry in recent" :key="entry.id" class="plan-observation">
        <text class="plan-caption">{{ prettyDate(entry.created_at) }} · 你留下的记录</text>
        <button class="plan-record-text" :class="{ 'plan-record-collapsed': selectedObservation !== entry.id }" :aria-expanded="selectedObservation === entry.id" @click="selectedObservation = selectedObservation === entry.id ? '' : entry.id" hover-class="pressed" :hover-start-time="0">{{ entry.text }}</button>
        <view v-if="!current.ended_at && selectedObservation === entry.id" class="plan-state-actions"><button class="plan-link" @click="chat('我留下的经历：' + entry.text)" hover-class="pressed" :hover-start-time="0">和 Bloom 聊聊</button><button v-if="entry.editable" class="plan-link" @click="emit('editRecord', entry)">自己修改记录</button></view>
      </view>
      <button class="plan-history plan-link" @click="journey" hover-class="pressed" :hover-start-time="0">回看一路上的变化 <SvgIcon name="arrow" :size="16" /></button>
      <view class="plan-decision">
        <button class="plan-disclosure" :aria-expanded="expanded" @click="expanded = !expanded" hover-class="pressed" :hover-start-time="0"><view><text class="plan-focus-title">关于这件事的整理</text><text class="plan-caption">选项、现实条件和还想了解的事</text></view><SvgIcon name="chevron" :style="{ transform: expanded ? 'rotate(90deg)' : 'none' }" :size="17" tone="muted" /></button>
        <view v-if="expanded" class="plan-decision-body">
          <text class="plan-caption">初次整理与后续保存的内容，可随时核对</text>
          <view v-for="field in fields" :key="field.key" class="plan-field"><text class="plan-input-label">{{ field.label }}</text><text v-for="(line,index) in card[field.key]" :key="index" class="plan-detail">{{ line }}</text></view>
          <text v-if="!fields.length" class="plan-empty-note">还没有留下这些内容，不必一次想清楚</text>
          <button v-if="!current.ended_at" class="plan-link" @click="emit('openEditor')" hover-class="pressed" :hover-start-time="0">查看与编辑完整卡片 <SvgIcon name="arrow-diagonal" :size="16" /></button>
        </view>
      </view>
      <button v-if="current.ended_at" class="plan-primary plan-resume" @click="emit('resume')" hover-class="pressed" :hover-start-time="0">恢复这个探索</button>
      <view v-else class="plan-closing"><text class="plan-caption">不必按时完成，也可以随时改主意</text><button class="plan-link" @click="emit('end')" hover-class="pressed" :hover-start-time="0">结束这个探索</button></view>
    </view>
  </view>
</template>

<style scoped>
.plan-journal { color:var(--ink); }
.plan-foreground { position:relative; z-index:1; }
.plan-focus { display:flex; align-items:center; gap:14px; padding:12px 0 4px; }
.plan-focus-copy { flex:1; min-width:0; }
.plan-caption { display:block; color:var(--muted); font-size:12px; line-height:1.8; font-weight:400; }
.plan-focus-title { display:block; color:var(--ink); font-size:14px; line-height:1.7; overflow-wrap:anywhere; }
.plan-intro { padding:12px 0 64px; }
.plan-heading { display:block; font-family:var(--font-heading); font-size:24px; line-height:1.5; font-weight:400; }
.plan-subtitle { display:block; margin-top:9px; color:var(--muted); font-size:13px; line-height:1.85; }
.plan-attempt { position:relative; padding:20px; border:1px solid var(--quote-border,var(--line)); border-radius:8px; background:linear-gradient(155deg,var(--quote-fill-a,var(--paper)),var(--quote-fill-b,var(--paper))); box-shadow:var(--quote-inset),var(--quote-shadow); }
.plan-companion { position:absolute; right:0; top:-58px; display:flex; align-items:center; gap:8px; }
.plan-bot { width:68px; height:70px; padding:0; margin:0; background:transparent; overflow:visible; border-radius:0; }
.plan-bot image { display:block; width:100%; height:100%; }
.plan-bubble { padding:7px 10px; min-height:44px; margin:0; color:var(--ink); background:var(--paper); border:1px solid var(--line); border-radius:8px; font-family:var(--font-body); font-size:12px; line-height:1.7; }
.plan-bot-pressed { opacity:.75; }
.plan-card-top { display:flex; align-items:center; gap:8px; }
.plan-attempt-title { display:block; margin:12px 0 0; font-family:var(--font-body); font-size:16px; font-weight:400; line-height:1.75; white-space:pre-wrap; overflow-wrap:anywhere; }
.plan-step-collapsed { display:-webkit-box; -webkit-line-clamp:4; -webkit-box-orient:vertical; overflow:hidden; }
.plan-latest { margin-top:16px; padding-top:12px; border-top:1px solid var(--line); }
.plan-latest .plan-detail { display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden; }
.plan-state-actions { display:flex; flex-wrap:wrap; gap:0 16px; margin-top:8px; }
.plan-detail { display:block; white-space:pre-wrap; overflow-wrap:anywhere; font-size:14px; line-height:1.85; margin-top:8px; }
.plan-actions { display:flex; flex-wrap:wrap; align-items:center; gap:6px 16px; margin-top:18px; }
.plan-link,.plan-primary { display:flex; align-items:center; justify-content:center; gap:7px; min-height:44px; box-sizing:border-box; border-radius:8px; font-family:var(--font-body); font-size:13px; font-weight:400; line-height:1.6; margin:0; }
.plan-link { padding:4px 0; color:var(--muted); background:transparent; }
.plan-primary { padding:11px 15px; color:var(--ink); background:var(--accent-light); border:1px solid var(--line); }
.plan-link::after,.plan-primary::after,.plan-bot::after,.plan-bubble::after,.plan-disclosure::after,.plan-record-text::after { border:0; }
.plan-conversation { border-top:1px solid var(--line); margin-top:16px; padding-top:16px; }
.plan-input-label { display:block; color:var(--ink); font-size:14px; line-height:1.7; }
.plan-input { display:block; box-sizing:border-box; width:100%; min-height:88px; padding:12px; margin:10px 0; font-size:16px; line-height:1.6; background:var(--paper); color:var(--ink); border:1px solid var(--line); border-radius:8px; }
.plan-conversation .plan-primary { margin-top:14px; width:100%; }
.plan-transfer-note { margin-top:10px; }
.plan-section-heading { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-top:24px; font-size:15px; }
.plan-empty-note { display:block; font-size:13px; line-height:1.9; color:var(--muted); padding:8px 0; }
.plan-observation { padding:13px 0; border-bottom:1px solid var(--line); }
.plan-record-text { display:block; width:100%; padding:7px 0 0; margin:0; min-height:44px; color:var(--ink); font-size:14px; line-height:1.85; font-weight:400; text-align:left; background:transparent; border-radius:6px; white-space:pre-wrap; overflow-wrap:anywhere; }
.plan-record-collapsed { display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden; }
.plan-history { justify-content:flex-start; margin:5px 0 16px; }
.plan-decision { border-top:1px solid var(--line); border-bottom:1px solid var(--line); }
.plan-disclosure { display:flex; width:100%; align-items:center; justify-content:space-between; gap:12px; padding:17px 0; margin:0; background:transparent; text-align:left; border-radius:6px; font-weight:400; }
.plan-disclosure .plan-caption { margin-top:4px; }
.plan-decision-body { padding:0 0 12px; }
.plan-field { margin-top:16px; }
.plan-closing { padding-top:20px; text-align:center; }
.plan-closing .plan-link { margin:auto; }
.plan-resume { margin-top:20px; width:100%; }
@media(max-width:360px) { .plan-heading { font-size:22px; } .plan-attempt { padding:17px; } .plan-attempt-title { font-size:16px; } .plan-actions { gap:6px 12px; } .plan-bubble { max-width:220px; } }
</style>

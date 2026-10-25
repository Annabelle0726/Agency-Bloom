<script setup lang="ts">
import { computed, getCurrentInstance, inject, isRef, onBeforeUnmount, reactive, ref, watch, type Ref } from 'vue'
import type { Conversation, ConversationSummary, Issue, Memory, User, InitialSnapshot } from '../domain'
import SvgIcon from './SvgIcon.vue'
import MemorySource from './MemorySource.vue'
import { snapshotRows } from '../me-records'
import { conversationGreeting } from '../conversation-greeting'
import { ICON_PALETTE_KEY, fallbackIconPalette, type IconPalette } from '../icon-system'
import { drawerAtmosphere } from '../drawer-atmosphere'
// Only this drawer consumes the global theme/form styles; its styles do not leak out.
defineOptions({ options: { styleIsolation: 'apply-shared' } })

type View = 'list' | 'summary' | 'memories' | 'direction' | 'details' | 'snapshots'
const props = defineProps<{
  view: View; conversations: Conversation[]; active: Conversation | null; issues: Issue[];
  user: User | null; summary: ConversationSummary | null; summaryDraft: ConversationSummary | null;
  generating: boolean; running: string[]; error?: string; initialIssueId?: string;
  request: <T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, data?: unknown) => Promise<T>
}>()
const providedPalette = inject<Ref<IconPalette> | IconPalette>(ICON_PALETTE_KEY, fallbackIconPalette)
const atmosphere = computed(() => drawerAtmosphere(isRef(providedPalette) ? providedPalette.value : providedPalette))
const emit = defineEmits<{
  close: []; select: [conversation: Conversation]; refresh: []; createIssue: []; selectIssue: [issue: Issue];
  newChat: []; generate: []; reviewed: [summary: ConversationSummary | null]; changed: [conversation: Conversation];
  userChanged: [user: User]; contextChanged: []; viewChanged: [view: View]; deleted: [id: string]
}>()
const busy = ref(false), notice = ref(''), archive = ref(false), filterIssue = ref(''), showExplorations = ref(false)
const search = ref('')
const instance = getCurrentInstance()
const scrollIndicator = ref<{ height: number; top: number } | null>(null)
let scrollTimer: ReturnType<typeof setTimeout> | undefined
let alive = true
onBeforeUnmount(() => { alive = false; clearTimeout(scrollTimer) })
function onScroll(event: { detail: { scrollTop: number; scrollHeight: number } }) {
  const { scrollTop, scrollHeight } = event.detail
  uni.createSelectorQuery().in(instance?.proxy).select('.drawer-scroll').boundingClientRect(rect => {
    if (!alive || !rect || Array.isArray(rect)) return
    const height = rect.height || 0
    if (scrollHeight <= height + 1) { scrollIndicator.value = null; return }
    const thumb = Math.max(8, Math.min(100, height / scrollHeight * 100))
    scrollIndicator.value = { height: thumb, top: Math.max(0, Math.min(100 - thumb, scrollTop / (scrollHeight - height) * (100 - thumb))) }
    clearTimeout(scrollTimer); scrollTimer = setTimeout(() => { scrollIndicator.value = null }, 800)
  }).exec()
}
const activeIssues = computed(() => props.issues.filter(i => !i.ended_at))
const visible = computed(() => props.conversations.filter(c => Boolean(c.archived_at) === archive.value && (!filterIssue.value || c.issue_id === filterIssue.value) && (!search.value.trim() || c.title.toLowerCase().includes(search.value.trim().toLowerCase()))))
const edited = reactive({ overview: '', decisions: '', open_questions: '', next_steps: '' })
const summaryFields = [{ key: 'decisions', label: '已经决定的' }, { key: 'open_questions', label: '还没弄清的' }, { key: 'next_steps', label: '接下来可做的' }] as const
const savedSummaryFingerprint = ref('')
const summarySaveError = ref('')
const summaryFingerprint = computed(() => JSON.stringify([edited.overview.trim(), ...summaryFields.map(field => edited[field.key].split('\n').map(line => line.trim()).filter(Boolean))]))
const summaryConfirmed = computed(() => !!savedSummaryFingerprint.value && savedSummaryFingerprint.value === summaryFingerprint.value)
watch([() => props.active?.id, () => props.view], () => { savedSummaryFingerprint.value = ''; summarySaveError.value = '' })
watch(() => props.summaryDraft, value => { if (value) savedSummaryFingerprint.value = '' })
const detailTitle = ref(props.active?.title || ''), linked = ref<string[]>([...(props.active?.linked_issue_ids || [])])
const memories = ref<Memory[]>([]), selected = ref<string[]>([]), editing = ref<Memory | null>(null), memoryForm = ref(false), merging = ref(false)
const memorySource = ref<string | null>(null)
const memoryContent = ref(''), category = ref<Memory['category']>('fact'), memoryScope = ref(''), memoryFilter = ref('all')
const horizon = ref<NonNullable<Memory['horizon']>>('long_term'), status = ref<NonNullable<Memory['status']>>('active'), keepHistory = ref(false)
const snapshots = ref<InitialSnapshot[]>([])
const snapshotsLoading=ref(false),snapshotError=ref('')
let snapshotEpoch=0,disposed=false
onBeforeUnmount(()=>{disposed=true;snapshotEpoch++})
const statusLabels = { active: '有效', needs_review: '待核实', historical: '历史' } as const
const categories = [{ id: 'fact', label: '事实' }, { id: 'preference', label: '偏好' }, { id: 'constraint', label: '约束' }] as const
const shownMemories = computed(() => memories.value.filter(m => (props.view !== 'direction' || m.horizon === 'current_phase') && (memoryFilter.value === 'all' || m.category === memoryFilter.value)))
const greetingIssue = computed(() => props.issues.find(i => i.id === (filterIssue.value || props.active?.issue_id)) || activeIssues.value[0])
const greeting = computed(() => conversationGreeting(!!props.user?.use_memory, memories.value, greetingIssue.value))
const heading = computed(() => ({ list: '会话与探索', summary: '整理当前会话', memories: '整理长期记忆', direction: '当前方向', details: '会话设置', snapshots:'初始快照' }[props.view]))
function issueName(id: string | null) { return props.issues.find(i => i.id === id)?.title || (id ? '未命名探索' : '所有探索') }
async function run(action: () => Promise<void>) { if (busy.value) return; busy.value = true; notice.value = ''; try { await action() } catch (e) { notice.value = e instanceof Error ? e.message : '暂时没有完成，请重试' } finally { busy.value = false } }
function confirm(title: string, content: string) { return new Promise<boolean>(resolve => uni.showModal({ title, content, confirmText: '确认', success: r => resolve(r.confirm), fail: () => resolve(false) })) }
watch(() => props.summaryDraft || props.summary, value => {
  edited.overview = value?.overview || ''
  for (const field of summaryFields) edited[field.key] = value?.[field.key].join('\n') || ''
}, { immediate: true })
watch(() => [props.view, props.user?.use_memory], () => {
  if (props.view === 'memories' || props.view === 'direction' || (props.view === 'list' && props.user?.use_memory)) void loadMemories()
}, { immediate: true })
function loadMemories() { return run(async () => {
  memories.value = await props.request('GET', '/memories'); selected.value = []
}) }
watch([()=>props.view,()=>props.user?.id,()=>props.initialIssueId,()=>props.issues.map(item=>item.id).join('|')],()=>{
  snapshotEpoch++;snapshots.value=[];snapshotError.value='';snapshotsLoading.value=false
  if(props.view==='snapshots')void loadSnapshots()
},{immediate:true,flush:'sync'})
async function loadSnapshots(){
  const epoch=++snapshotEpoch,owner=props.user?.id
  snapshots.value=[];snapshotError.value=''
  if(!owner){snapshotsLoading.value=false;return}
  snapshotsLoading.value=true
  const ids=[...new Set([props.initialIssueId,...props.issues.map(item=>item.id)].filter((id):id is string=>!!id))]
  const results=await Promise.allSettled(ids.map(async id=>props.request<InitialSnapshot|null>('GET',`/issues/${encodeURIComponent(id)}/snapshot`)))
  if(disposed||epoch!==snapshotEpoch||owner!==props.user?.id)return
  snapshots.value=results.flatMap(result=>result.status==='fulfilled'&&result.value?[result.value]:[])
  const failed=results.find(result=>result.status==='rejected')
  if(failed&&failed.status==='rejected')snapshotError.value=snapshots.value.length?'部分初始快照暂时未能读取，可以重试':failed.reason instanceof Error?failed.reason.message:'暂时无法读取初始快照，请重试'
  snapshotsLoading.value=false
}
async function deleteSnapshot(item: InitialSnapshot) {
  const owner=props.user?.id
  if(!owner)return
  if (!await confirm('删除这份初始资料？', '这份注册回答和卡片中的原始背景副本将删除，独立保存的卡片内容、记忆和历史聊天仍保留，可分别管理')) return
  if(disposed||owner!==props.user?.id||!snapshots.value.some(s=>s.id===item.id&&s.version===item.version))return
  await run(async () => { snapshotEpoch++;await props.request('DELETE', `/issues/${encodeURIComponent(item.id.replace('snapshot:', ''))}/snapshot?version=${item.version}`);if(disposed||owner!==props.user?.id)return;snapshots.value = snapshots.value.filter(s => s.id !== item.id); emit('refresh'); emit('contextChanged') })
}
function openNewConversation() {
  if (!activeIssues.value.length) { emit('createIssue'); return }
  emit('newChat')
}
async function archiveConversation(item: Conversation) {
  if (!item.archived_at && !await confirm('归档这段会话？', '会话会移入归档列表，所属探索继续保留。未开启聊天保存时，原文只在本次使用中可见')) return
  await run(async () => { const updated = await props.request<Conversation>('PUT', `/conversations/${item.id}`, { version: item.version, archived: !item.archived_at }); emit('changed', updated); emit('refresh') })
}
async function deleteConversation(item: Conversation) {
  if (busy.value || !await confirm('删除这段会话？', '这段会话的消息、总结和未发送草稿将永久删除，正在生成的回复会停止。探索卡片和已确认的长期记忆保留；记忆可单独删除')) return
  await run(async () => {
    await props.request('DELETE', `/conversations/${item.id}?version=${item.version}`)
    emit('deleted', item.id); notice.value = '会话已删除'
  })
}
async function saveDetails() { if (!props.active) return; await run(async () => {
  const item = await props.request<Conversation>('PUT', `/conversations/${props.active!.id}`, { version: props.active!.version, title: detailTitle.value, linked_issue_ids: linked.value })
  emit('changed', item); emit('contextChanged'); notice.value = '会话设置已保存'
}) }
function toggleLink(id: string) { if (linked.value.includes(id)) linked.value = linked.value.filter(x => x !== id); else if (linked.value.length < 3) linked.value.push(id) }
async function saveSummary() { if (!props.active || summaryConfirmed.value) return; summarySaveError.value = ''; await run(async () => {
  const summary: ConversationSummary = { overview: edited.overview.trim(), decisions: [], open_questions: [], next_steps: [] }
  for (const field of summaryFields) {
    summary[field.key] = edited[field.key].split('\n').map(s => s.trim()).filter(Boolean)
    if (summary[field.key].length > 12 || summary[field.key].some(s => s.length > 400)) throw Error('每项最多12行，每行最多400字')
  }
  if (!summary.overview && !summary.decisions.length && !summary.open_questions.length && !summary.next_steps.length) throw Error('先留下要接续的内容')
  if (props.user?.save_chat) emit('changed', await props.request<Conversation>('PUT', `/conversations/${props.active!.id}/summary`, { version: props.active!.version, summary }))
  emit('reviewed', summary); notice.value = props.user?.save_chat ? '已保存审阅后的总结，下次对话会接续' : '已用于本次会话；退出后不会保留'
  savedSummaryFingerprint.value = summaryFingerprint.value
}); if (!summaryConfirmed.value) summarySaveError.value = notice.value }
async function clearSummary() { if (!props.active || !await confirm('清除会话总结？', '之后不再将这份总结作为上下文，消息与长期记忆保持独立')) return; await run(async () => {
  if (props.user?.save_chat) emit('changed', await props.request<Conversation>('PUT', `/conversations/${props.active!.id}/summary`, { version: props.active!.version, summary: null }))
  emit('reviewed', null); savedSummaryFingerprint.value = ''; notice.value = '总结已清除'
}) }
function editMemory(item?: Memory, content = '', sourceId: string | null = null) { memorySource.value = item ? item.source_conversation_id : sourceId; editing.value = item || null; merging.value = false; memoryContent.value = item?.content || content; category.value = item?.category || 'fact'; memoryScope.value = item?.issue_id || ''; horizon.value = item?.horizon || (props.view === 'direction' ? 'current_phase' : 'long_term'); status.value = item?.status || 'active'; keepHistory.value = false; memoryForm.value = true }
function prepareMerge() {
  const chosen = memories.value.filter(m => selected.value.includes(m.id)); if (chosen.length < 2) return
  editing.value = null; merging.value = true; memoryContent.value = chosen.map(m => m.content).join('\n'); category.value = chosen[0].category
  memorySource.value = chosen.every(m => m.source_conversation_id === chosen[0].source_conversation_id) ? chosen[0].source_conversation_id : null
  memoryScope.value = chosen.every(m => m.issue_id === chosen[0].issue_id) ? chosen[0].issue_id || '' : props.active?.issue_id || ''
  horizon.value = chosen[0].horizon || 'long_term'; status.value = 'active'; keepHistory.value = false
  memoryForm.value = true
}
async function saveMemory() { await run(async () => {
  if (!memoryContent.value.trim() || memoryContent.value.length > 400) throw Error('请整理成1到400字，再确认保存')
  const body = { content: memoryContent.value.trim(), category: category.value, issue_id: memoryScope.value || null,
    horizon: horizon.value, status: status.value,
    source_conversation_id: memorySource.value, enabled: editing.value?.enabled ?? true, confirmed: true }
  if (merging.value) await props.request('POST', '/memories/merge', { ...body, items: memories.value.filter(m => selected.value.includes(m.id)).map(({ id, version }) => ({ id, version })) })
  else if (editing.value && keepHistory.value) {
    if (category.value !== editing.value.category || memoryScope.value !== (editing.value.issue_id || '') || horizon.value !== (editing.value.horizon || 'long_term') || status.value !== 'active') throw Error('保留历史时沿用原分类与范围；若要调整它们，请先取消保留历史')
    await props.request('POST', `/memories/${editing.value.id}/replace`, { content: body.content, version: editing.value.version, confirmed: true, keep_history: true })
  }
  else if (editing.value) await props.request('PUT', `/memories/${editing.value.id}`, { ...body, version: editing.value.version })
  else await props.request('POST', '/memories', body)
  memories.value = await props.request('GET', '/memories'); selected.value = []; memoryForm.value = false; emit('contextChanged'); notice.value = '已保存你确认的记忆'
}) }
async function toggleMemory(item: Memory) { await run(async () => {
  await props.request('PUT', `/memories/${item.id}`, { content: item.content, category: item.category, issue_id: item.issue_id, source_conversation_id: item.source_conversation_id, enabled: !item.enabled, status: item.status || 'active', confirmed: true, version: item.version })
  memories.value = await props.request('GET', '/memories'); emit('contextChanged')
}) }
async function deleteMemory(item: Memory) { if (!await confirm('删除这条记忆？', '删除后不会再用于后续回复，历史聊天原文不会被改写')) return; await run(async () => {
  await props.request('DELETE', `/memories/${item.id}?version=${item.version}`); memories.value = memories.value.filter(m => m.id !== item.id); selected.value = selected.value.filter(id => id !== item.id); emit('contextChanged')
}) }
function toggleSelection(id: string) { if (selected.value.includes(id)) selected.value = selected.value.filter(x => x !== id); else if (selected.value.length < 10) selected.value.push(id) }
async function toggleUseMemory() { await run(async () => { emit('userChanged', await props.request<User>('PUT', '/me', { use_memory: !props.user?.use_memory })); emit('contextChanged') }) }
function rememberSummary(content: string) { emit('viewChanged', 'memories'); editMemory(undefined, content, props.active?.id || null) }
</script>

<template>
  <view class="workspace-backdrop" @click.self="!busy && emit('close')">
    <view class="workspace-drawer" role="dialog" :aria-label="heading" @click.stop>
      <image class="drawer-atmosphere drawer-atmosphere-canopy" :src="atmosphere.canopy" mode="aspectFit" :draggable="false" aria-hidden="true" />
      <image class="drawer-atmosphere drawer-atmosphere-stem" :src="atmosphere.stem" mode="aspectFit" :draggable="false" aria-hidden="true" />
      <view class="drawer-heading"><view><text class="eyebrow">YOUR SPACE</text><text class="section-title">{{ heading }}</text></view><button class="icon-button" :disabled="busy" aria-label="关闭会话面板" @click="emit('close')"><SvgIcon name="close" :size="20" /></button></view>
      <view class="drawer-tabs"><button class="drawer-main-tab" data-view="list" :aria-pressed="['list','summary','details'].includes(view)" @click="emit('viewChanged', 'list')"><text class="drawer-tab-label" :class="{ selected: ['list','summary','details'].includes(view) }">会话</text></button><button class="drawer-main-tab" data-view="memories" :aria-pressed="view === 'memories'||view==='direction'" @click="emit('viewChanged', 'memories')"><text class="drawer-tab-label" :class="{ selected: view === 'memories'||view==='direction' }">长期记忆</text></button><button class="drawer-main-tab" data-view="snapshots" :aria-pressed="view==='snapshots'" @click="emit('viewChanged','snapshots')"><text class="drawer-tab-label" :class="{selected:view==='snapshots'}">初始快照</text></button></view>
      <view class="drawer-body">
      <scroll-view scroll-y enhanced :show-scrollbar="false" class="drawer-scroll" @scroll="onScroll">
        <view class="drawer-scroll-content">
        <view v-if="notice || error" class="notice">{{ notice || error }}</view>
        <template v-if="view === 'list'">
          <button class="primary new-conversation" :disabled="busy" hover-class="new-conversation-pressed" :hover-start-time="0" :hover-stay-time="70" @click="openNewConversation()">＋ 新会话</button>
          <view class="drawer-search"><input v-model="search" class="drawer-search-input" maxlength="60" placeholder="搜索会话" placeholder-class="drawer-search-placeholder" aria-label="搜索会话" /></view>
          <view class="drawer-tabs drawer-filter-tabs conversation-sections"><button :class="{ selected: !archive && !showExplorations }" @click="archive = false; showExplorations = false">进行中</button><button :class="{ selected: showExplorations }" @click="showExplorations = true">探索</button><button :class="{ selected: archive && !showExplorations }" @click="archive = true; showExplorations = false">已归档</button></view>
          <template v-if="!showExplorations">
            <scroll-view scroll-x enhanced :show-scrollbar="false" class="scope-filters"><button :class="{ selected: !filterIssue }" @click="filterIssue = ''">全部探索</button><button v-for="issue in issues" :key="issue.id" :class="{ selected: filterIssue === issue.id }" @click="filterIssue = issue.id">{{ issue.title || '未命名探索' }}</button></scroll-view>
            <view v-if="!visible.length" class="drawer-empty">
              <text class="empty-heading">{{ archive ? '还没有归档的会话' : search.trim() ? '没有匹配的会话' : '留一点空间，聊聊现在' }}</text>
              <text class="muted empty-greeting">{{ archive ? '归档后的会话会留在这里，随时可以恢复' : greeting }}</text>
              <button class="secondary empty-create" :disabled="busy" @click="openNewConversation">＋ 从一段新会话开始</button>
            </view>
            <view v-for="item in visible" :key="item.id" class="conversation-item" :class="{ active: active?.id === item.id }">
              <button class="conversation-select" :disabled="busy" @click="emit('select', item)"><text class="conversation-title">{{ item.title }}</text><text class="muted small">{{ issueName(item.issue_id) }}</text><text class="muted small">{{ running.includes(item.id) ? '正在回应…' : new Date(item.updated_at).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }) }} · {{ user?.save_chat ? '已保存' : '原文未保存' }}</text></button>
              <view class="conversation-actions"><button class="text-button archive-action" :disabled="busy" @click="archiveConversation(item)">{{ item.archived_at ? '恢复会话' : '归档' }}</button><button class="text-button delete-conversation" :disabled="busy" @click="deleteConversation(item)">删除</button></view>
            </view>
          </template>
          <template v-else><button v-for="issue in issues" :key="issue.id" class="exploration-item" @click="emit('selectIssue', issue)"><text>{{ issue.title || '未命名探索' }}</text><text class="muted small">{{ issue.ended_at ? '已结束 · 查看或恢复' : '进行中 · 打开探索' }}</text></button><button class="secondary" @click="emit('createIssue')">＋ 开始另一个探索</button></template>
        </template>
        <template v-else-if="view === 'summary'">
          <text class="body-copy">整理已审阅总结与最近最多80条消息。新总结先作为草稿，不会自动写入卡片或长期记忆</text>
          <text class="muted small">{{ user?.save_chat ? '确认后保存到这段会话' : '未开启聊天保存：确认后仅用于本次使用，退出即清除' }}</text>
          <button class="secondary generate-summary" :disabled="busy || generating || !active || !!active.archived_at" @click="emit('generate')">{{ generating ? '正在整理…' : '生成总结草稿' }}</button>
          <text v-if="summaryDraft" class="summary-status">待你审阅的草稿</text>
          <text class="field-label">这次聊到了什么</text><textarea v-model="edited.overview" class="text-area" maxlength="1200" placeholder="主题、关键进展，以及仍然不确定的地方" />
          <view v-for="field in summaryFields" :key="field.key"><text class="field-label">{{ field.label }} · 每行一项</text><textarea v-model="edited[field.key]" class="text-area compact" maxlength="4800" /></view>
          <text v-if="summaryConfirmed" class="summary-confirmation-status" role="status" aria-live="polite">{{ user?.save_chat ? '已保存，下次对话会接续这份总结' : '已用于本次会话，退出后不会保留' }}</text>
          <text v-if="summarySaveError" class="summary-save-error" role="alert">{{ summarySaveError }}</text>
          <button class="primary confirm-summary" :disabled="busy || generating || !active || summaryConfirmed" @click="saveSummary">{{ busy ? '正在保存…' : summaryConfirmed ? (user?.save_chat ? '已保存' : '已用于本次会话') : '确认这份总结' }}</button>
          <button v-if="summary" class="text-button" :disabled="busy || generating" @click="clearSummary">清除已确认总结</button>
          <view v-if="summary" class="summary-to-memory"><text class="field-label">哪些内容值得长期记住？</text><text class="muted small">选择后仍可编辑，单独确认保存</text><button v-for="line in summary.decisions" :key="line" class="memory-candidate" @click="rememberSummary(line)">{{ line }} ＋</button><button class="text-button" @click="rememberSummary('')">自己写一条长期记忆</button></view>
        </template>
        <template v-else-if="view === 'details' && active">
          <text class="field-label">会话名称</text><input v-model="detailTitle" class="text-input" maxlength="120" />
          <text class="field-label">主要探索：{{ issueName(active.issue_id) }}</text>
          <text class="body-copy">额外关联最多3个探索，仅带入其卡片，不读取它们的聊天原文</text>
          <button v-for="issue in issues.filter(i => i.id !== active!.issue_id)" :key="issue.id" class="link-choice" :aria-pressed="linked.includes(issue.id)" @click="toggleLink(issue.id)">{{ linked.includes(issue.id) ? '✓ ' : '＋ ' }}{{ issue.title || '未命名探索' }}</button>
          <button class="primary" :disabled="busy || generating || !detailTitle.trim()" @click="saveDetails">保存会话设置</button>
        </template>
        <template v-else-if="view==='snapshots'">
          <text class="snapshot-intro">这是当时留下的起点，不是对你的永久定义</text>
          <text class="snapshot-readonly">初始快照仅供查看，不能修改</text>
          <text v-if="snapshotsLoading" class="drawer-loading" role="status">正在读取初始快照…</text>
          <view v-if="snapshotError" class="drawer-load-error snapshot-load-error" role="alert"><text>{{ snapshotError }}</text><button class="text-button snapshot-retry" :disabled="snapshotsLoading" @click="loadSnapshots">重试</button></view>
          <text v-if="!snapshotsLoading&&!snapshotError&&!snapshots.length" class="muted drawer-empty snapshot-empty">还没有保存初始快照，可以直接从对话开始</text>
          <view v-for="item in snapshots" :key="item.id" class="memory-item snapshot-item" :data-snapshot="item.id">
            <view class="snapshot-card-meta"><view class="snapshot-origin"><SvgIcon name="leaf" :size="15" tone="accent"/><text>初始整理</text></view><text class="snapshot-date">{{ item.captured_at.slice(0,10).replace(/-/g,'.') }}</text></view>
            <text class="snapshot-card-title" :selectable="true">{{ item.direction || '当时尚未确定方向' }}</text>
            <text v-if="issueName(item.id.replace('snapshot:',''))!==item.direction" class="snapshot-scope">{{ issueName(item.id.replace('snapshot:','')) }}</text>
            <view class="snapshot-answers">
              <view v-for="(row,index) in snapshotRows(item)" :key="index" class="memory-snapshot-answer"><text class="snapshot-answer-label">{{ row.label }}</text><text class="snapshot-answer-value" :class="{'snapshot-unfilled':['未填写','未选择','未记录'].includes(row.value)}" :selectable="true">{{ row.value }}</text></view>
            </view>
            <view class="snapshot-card-footer"><button class="text-button delete-snapshot" :disabled="busy||snapshotsLoading" hover-class="snapshot-pressed" :hover-start-time="0" @click="deleteSnapshot(item)">删除这份快照</button></view>
          </view>
        </template>
        <template v-else-if="view === 'memories' || view === 'direction'">
          <button class="memory-use setting-row" :aria-pressed="!!user?.use_memory" :disabled="busy" @click="toggleUseMemory"><view><text class="setting-title">在回复中使用长期记忆</text><text class="setting-description">{{ user?.use_memory ? '仅使用启用且范围匹配的记忆' : '已关闭 · 保存的记忆仍可整理' }}</text></view><view class="toggle" :class="{ on: user?.use_memory }"><view /></view></button>
          <text class="muted small">最多40条；只保存你明确确认的内容。删除记忆不会删除历史聊天中的原文</text>
          <view class="memory-toolbar"><button class="secondary" :disabled="busy" @click="editMemory()">{{ view === 'direction' ? '＋ 添加当前方向' : '＋ 添加记忆' }}</button><button class="secondary" :disabled="busy || selected.length < 2" @click="prepareMerge">合并选中 {{ selected.length || '' }}</button></view>
          <text class="memory-merge-hint">{{ selected.length < 2 ? '选中至少两条记忆后可以合并' : `已选 ${selected.length} 条记忆，可合并整理` }}</text>
          <view v-if="memoryForm" class="drawer-form memory-editor">
            <text class="field-label">{{ merging ? '审阅合并结果 · 保存后替换选中的记忆' : editing ? '编辑记忆' : '你希望长期记住什么？' }}</text>
            <textarea v-model="memoryContent" class="text-area" :maxlength="-1" placeholder="写具体事实或偏好，避免替自己下结论" /><text class="muted small">{{ memoryContent.length }} / 400</text>
            <view class="drawer-tabs"><button v-for="kind in categories" :key="kind.id" :class="{ selected: category === kind.id }" @click="category = kind.id">{{ kind.label }}</button></view>
            <text class="field-label">适用阶段</text><view class="drawer-tabs"><button :class="{ selected: horizon === 'long_term' }" @click="horizon = 'long_term'">长期</button><button :class="{ selected: horizon === 'current_phase' }" @click="horizon = 'current_phase'">当前阶段</button></view>
            <view class="drawer-tabs"><button v-for="(label, value) in statusLabels" :key="value" :class="{ selected: status === value }" @click="status = value">{{ label }}</button></view>
            <button v-if="editing && editing.status !== 'historical'" class="text-button" :aria-pressed="keepHistory" @click="keepHistory = !keepHistory">{{ keepHistory ? '☑' : '□' }} 保留修改前的版本作为历史</button>
            <text class="field-label">使用范围（选择所有探索会跨会话使用）</text><scroll-view scroll-x class="scope-filters"><button :class="{ selected: !memoryScope }" @click="memoryScope = ''">所有探索</button><button v-for="issue in issues" :key="issue.id" :class="{ selected: memoryScope === issue.id }" @click="memoryScope = issue.id">{{ issue.title || '未命名探索' }}</button></scroll-view>
            <button class="primary confirm-memory" :disabled="busy || !memoryContent.trim() || memoryContent.length > 400" @click="saveMemory">确认并保存记忆</button><button class="text-button" :disabled="busy" @click="memoryForm = false">取消编辑</button>
          </view>
          <view class="drawer-tabs drawer-filter-tabs memory-filters"><button :class="{ selected: memoryFilter === 'all' }" :aria-pressed="memoryFilter==='all'" @click="memoryFilter = 'all'">全部</button><button v-for="kind in categories" :key="kind.id" :class="{ selected: memoryFilter === kind.id }" :aria-pressed="memoryFilter===kind.id" @click="memoryFilter = kind.id">{{ kind.label }}</button></view>
          <text v-if="!shownMemories.length" class="muted drawer-empty">这里还没有记忆，由你决定留下什么</text>
          <view v-for="item in shownMemories" :key="item.id" class="memory-item" :class="{ disabled: !item.enabled }">
            <view class="memory-record-head"><button class="memory-merge-select" :aria-label="'选择用于合并：' + item.content" :aria-pressed="selected.includes(item.id)" :disabled="busy" @click="toggleSelection(item.id)"><text>{{ selected.includes(item.id) ? '☑' : '□' }}</text></button><button class="memory-select" :aria-label="'查看与修改：' + item.content" :disabled="busy" @click="editMemory(item)"><text>{{ item.content }}</text></button></view>
            <text class="muted small">{{ categories.find(k => k.id === item.category)?.label }} · {{ issueName(item.issue_id) }} · {{ item.enabled ? '启用' : '停用' }}</text>
            <text class="muted small">{{ item.horizon === 'current_phase' ? '当前阶段' : '长期' }} · {{ statusLabels[item.status || 'active'] }} · 来源：{{ item.source === 'user_revision' ? '用户确认的更新' : '用户确认' }}</text>
            <text class="muted small">创建 {{ item.created_at?.slice(0, 10) || '时间未知' }} · 确认 {{ item.confirmed_at?.slice(0, 10) || '旧记录未记载' }} · 最近核实 {{ item.last_verified_at?.slice(0, 10) || '未记载' }}</text>
            <MemorySource :item="item" :user-id="user?.id || ''" :retain-chat="!!user?.save_chat" :request="request" />
            <view class="memory-actions"><button @click="editMemory(item)">编辑</button><button :disabled="busy" @click="toggleMemory(item)">{{ item.enabled ? '停用' : '启用' }}</button><button :disabled="busy" @click="deleteMemory(item)">删除</button></view>
          </view>
        </template>
        </view>
      </scroll-view>
      <view v-if="scrollIndicator" class="drawer-scroll-indicator" aria-hidden="true"><view :style="{ height: scrollIndicator.height + '%', top: scrollIndicator.top + '%' }" /></view>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.memory-record-head { display:flex; align-items:flex-start; gap:4px; }
.memory-merge-select { flex:0 0 44px; width:44px; min-height:44px; color:var(--accent); background:transparent; font-size:17px; line-height:1.6; }
.memory-record-head .memory-select { flex:1; min-width:0; }
.drawer-main-tab::after,.drawer-heading .icon-button::after { border:0; }
.snapshot-intro { display:block; margin:4px 0 18px; padding:0 2px; color:var(--muted); font-family:var(--font-body); font-size:13px; line-height:22px; }
.snapshot-readonly { display:block; margin:-10px 0 18px; padding:0 2px; color:var(--muted); font-family:var(--font-body); font-size:12px; line-height:20px; }
.snapshot-item { box-sizing:border-box; margin:0 0 16px; padding:18px 16px 10px; border:1px solid var(--quote-border); border-radius:8px; background:linear-gradient(155deg,var(--quote-fill-a),var(--quote-fill-b)); box-shadow:var(--quote-inset); }
.snapshot-card-meta { display:flex; flex-wrap:nowrap; align-items:center; justify-content:space-between; gap:10px; color:var(--muted); font-family:var(--font-body); font-size:11px; line-height:18px; }
.snapshot-origin { display:flex; align-items:center; gap:6px; color:var(--accent); }
.snapshot-date { flex-shrink:0; white-space:nowrap; }
.snapshot-card-title { display:block; margin-top:12px; color:var(--ink); font-family:var(--font-heading); font-size:20px; font-weight:400; line-height:30px; overflow-wrap:break-word; }
.snapshot-scope { display:block; margin-top:6px; color:var(--muted); font-family:var(--font-body); font-size:12px; line-height:20px; overflow-wrap:break-word; }
.snapshot-answers { margin-top:14px; border-top:1px solid var(--line); }
.snapshot-item .memory-snapshot-answer { margin:0; padding:13px 0; border-bottom:1px solid var(--line); }
.snapshot-item .memory-snapshot-answer:last-child { border-bottom:0; }
.snapshot-answer-label { display:block; margin-bottom:5px; color:var(--muted); font-family:var(--font-body); font-size:12px; line-height:19px; }
.snapshot-answer-value { display:block; color:var(--ink); font-family:var(--font-body); font-size:14px; font-weight:400; line-height:24px; white-space:pre-wrap; overflow-wrap:break-word; }
.snapshot-answer-value.snapshot-unfilled { color:var(--muted); font-size:13px; }
.snapshot-card-footer { display:flex; align-items:center; justify-content:flex-end; min-height:28px; margin-top:2px; border-top:1px solid var(--line); padding-top:8px; }
.snapshot-card-footer .delete-snapshot { display:flex; align-items:center; justify-content:flex-end; min-height:44px; margin:-8px 0; padding:0 2px; color:var(--muted); background:transparent; font-family:var(--font-body); font-size:12px; line-height:20px; border-radius:6px; }
.delete-snapshot::after,.snapshot-retry::after { border:0; }
.snapshot-pressed { opacity:.65; }
.snapshot-load-error,.snapshot-empty { display:block; box-sizing:border-box; padding:16px; border:1px solid var(--line); border-radius:8px; background:var(--soft); font-family:var(--font-body); font-size:13px; line-height:23px; color:var(--ink); }
.snapshot-load-error .snapshot-retry { display:flex; align-items:center; min-height:44px; margin:4px 0 -6px; padding:0; color:var(--action-text); background:transparent; font-family:var(--font-body); font-size:13px; }
@media (max-width:360px) { .snapshot-item { padding:16px 13px 10px; } .snapshot-card-title { font-size:19px; line-height:29px; } }
</style>

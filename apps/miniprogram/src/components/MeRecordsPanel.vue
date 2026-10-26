<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import SvgIcon from './SvgIcon.vue'
import { phaseRecords, snapshotRows, useMeRecords, type MeRequest } from '../me-records'
import type { Issue, User } from '../domain'
import { sharedContext } from '../personal-context'
defineOptions({ options: { styleIsolation: 'apply-shared' } })
const props = defineProps<{ user: User | null; current: Issue | null; request: MeRequest; revision: number; busy: boolean; themeId: string }>()
const emit = defineEmits<{ direction: []; memories: []; changed: []; userChanged: [user: User] }>()
const { memories, snapshot, loading, memoryError, snapshotError, reload } = useMeRecords(() => props.user?.id || '', () => props.current?.id || '', () => props.revision, (...args) => props.request(...args))
const phases = computed(() => phaseRecords(memories.value, props.current?.id || ''))
const common = computed(() => sharedContext(memories.value))
const open = ref(false), saving = ref(false), actionError = ref(''), preferenceUncertain = ref(false)
const rows = computed(() => snapshot.value ? snapshotRows(snapshot.value) : [])
watch(() => [props.user?.id, props.current?.id], () => { open.value = false; actionError.value = ''; preferenceUncertain.value = false })
const date = (value?: string | null) => value ? value.slice(0, 10) : '未记录'
async function toggleMemoryUse() {
  if (saving.value || props.busy || !props.user) return
  const owner = props.user.id
  saving.value = true; actionError.value = ''
  let acknowledged = false
  try {
    await props.request('PUT', '/me', { use_memory: !props.user.use_memory })
    acknowledged = true
    if (props.user?.id === owner) emit('changed')
    const user = await props.request<User>('GET', '/me')
    if (props.user?.id === owner) { emit('userChanged', user); preferenceUncertain.value = false }
  } catch (error) { if (props.user?.id === owner) { preferenceUncertain.value = acknowledged; actionError.value = acknowledged ? '设置已提交，但未能确认当前状态，请重新读取' : error instanceof Error ? error.message : '未能更新，请重试' } }
  finally { saving.value = false }
}
async function confirmPreference() {
  if (saving.value) return
  const owner = props.user?.id
  saving.value = true
  try {
    const user = await props.request<User>('GET', '/me')
    if (props.user?.id === owner) { emit('userChanged', user); preferenceUncertain.value = false; actionError.value = '' }
  } catch { if (props.user?.id === owner) actionError.value = '仍未读取到设置，请稍后重试' }
  finally { saving.value = false }
}
async function removeSnapshot() {
  const item = snapshot.value, owner = props.user?.id
  if (!item || saving.value || props.busy) return
  const confirmed = await new Promise<boolean>(resolve => uni.showModal({ title: '删除这份初始回答？', content: '这份回答与卡片中的原始背景副本将删除，之后不再作为初始资料使用。独立保存的记忆、记录及历史聊天仍保留，可分别管理', confirmText: '删除', success: r => resolve(r.confirm), fail: () => resolve(false) }))
  if (!confirmed || owner !== props.user?.id || snapshot.value?.id !== item.id) return
  saving.value = true; actionError.value = ''
  try {
    await props.request('DELETE', `/issues/${encodeURIComponent(item.id.replace('snapshot:', ''))}/snapshot?version=${item.version}`)
    if (owner === props.user?.id) { emit('changed'); await reload() }
  } catch (error) { if (owner === props.user?.id) actionError.value = error instanceof Error ? error.message : '删除未完成，回答仍保留，请重试' }
  finally { saving.value = false }
}
function journey() {
  uni.navigateTo({ url: '/pages/journey/index?from=me&theme=' + props.themeId + (props.current ? '&issue=' + encodeURIComponent(props.current.id) : '') })
}
</script>
<template>
  <view class="me-records">
    <view class="me-section-heading"><text class="me-section-title">我目前在意的</text><button class="me-inline" :disabled="busy" @click="emit('direction')" hover-class="pressed">{{ phases.length ? '查看与修改' : '自己写一条' }}<SvgIcon name="chevron" :size="14" /></button></view>
    <text class="me-scope">{{ current ? '这段探索 · ' + (current.title || '未命名探索') : '所有探索 · 也可以先不确定方向' }}</text>
    <view class="me-phase-card">
      <text v-if="loading" class="me-record-copy" role="status">正在读取你确认的内容…</text>
      <view v-else-if="memoryError" class="me-local-error"><text>{{ memoryError }}</text><button class="me-inline" @click="reload">重新读取</button></view>
      <template v-else-if="phases.length">
        <view v-for="item in phases.slice(0, 2)" :key="item.id" class="me-phase-item">
          <text class="me-record-copy">{{ item.content }}</text>
          <text class="me-record-meta">{{ item.category === 'constraint' ? '现实条件' : item.category === 'preference' ? '在意与偏好' : '已确认的内容' }} · {{ item.issue_id ? '这段探索' : '所有探索' }} · {{ !item.enabled ? '已停用' : item.status === 'needs_review' ? '待核实' : '已启用' }}</text>
          <text class="me-record-meta">{{ item.source === 'user_revision' ? '你确认的更新' : '你确认留下' }}{{ item.confirmed_at ? ' · ' + date(item.confirmed_at) : ' · 确认日期未记录' }}{{ item.last_verified_at ? ' · 核实 ' + date(item.last_verified_at) : '' }}</text>
        </view>
        <button v-if="phases.length > 2" class="me-inline" @click="emit('direction')">查看全部 {{ phases.length }} 条</button>
      </template>
      <template v-else><text class="me-record-copy">还没有确认当前方向</text><text class="me-record-meta">可以自己写一条，也可以先聊聊</text></template>
    </view>
    <view class="me-section-heading"><text class="me-section-title">我确认留下的</text></view>
    <view class="me-shared-context">
      <text class="me-record-title">跨问题的共同背景</text>
      <text class="me-record-description">{{ user?.use_memory ? '只在相关时使用你确认的全局记忆；每个问题的计划仍分别管理' : '记忆使用已关闭，这些内容不会因此自动用于回复' }}</text>
      <text v-if="loading" class="me-record-copy">正在读取…</text>
      <text v-else-if="memoryError" class="me-record-copy">暂时无法读取，进入记忆管理后可以重试</text>
      <template v-else><text v-for="item in common" :key="item.id" class="me-shared-line" :selectable="true">{{ item.content }}</text><text v-if="!common.length" class="me-record-copy">还没有启用的共同背景，可以自行添加并选择适用范围</text></template>
      <button class="me-inline" :disabled="busy" @click="emit('memories')">查看、修改或停用</button>
    </view>
    <button class="me-record-row" :disabled="busy" @click="emit('memories')" hover-class="pressed"><view><text class="me-record-title">整理我的记忆</text><text class="me-record-description">{{ loading ? '正在读取…' : memoryError ? '读取失败 · 进入后重试' : memories.length ? memories.length + ' 条已保存 · 查看原文、范围与来源' : '还没有记录 · 可以自己添加' }}</text></view><SvgIcon name="chevron" :size="17" /></button>
    <button class="me-record-row" :disabled="busy || saving || preferenceUncertain" :aria-pressed="!!user?.use_memory" @click="toggleMemoryUse" hover-class="pressed"><view><text class="me-record-title">在回复中使用记忆</text><text class="me-record-description">{{ user?.use_memory ? '已开启 · 仅使用启用且范围匹配的记录' : '已关闭 · 已保存的记录仍可查看和修改' }}</text></view><view class="toggle" :class="{ on: user?.use_memory }"><view /></view></button>
    <button v-if="preferenceUncertain" class="me-inline me-confirm-preference" :disabled="saving" @click="confirmPreference">重新确认设置</button>
    <text class="me-record-note">保存和使用是两件事，是否用于回复由你决定</text>
    <view class="me-section-heading me-past-heading"><text class="me-section-title">起点与变化</text></view>
    <button class="me-record-row me-snapshot-entry" :disabled="loading || !snapshot" :aria-expanded="open" @click="open = !open" hover-class="pressed"><view><text class="me-record-title">最初留下的回答</text><text class="me-record-description">{{ loading ? '正在读取…' : snapshotError ? '暂时无法读取' : snapshot ? date(snapshot.captured_at) + ' · 当时的回答，可以展开查看' : current ? '没有初始回答 · 不需要补做问卷' : '尚未选择探索 · 当前方向仍可手动添加' }}</text></view><SvgIcon v-if="snapshot" :name="open ? 'close' : 'chevron'" :size="17" /></button>
    <view v-if="snapshotError" class="me-local-error"><text>{{ snapshotError }}</text><button class="me-inline" @click="reload">重新读取初始回答</button></view>
    <view v-if="open && snapshot" class="me-snapshot-detail">
      <text class="me-record-note">来源：{{ snapshot.source === 'onboarding' ? '你自愿提供的初始回答' : snapshot.source }} · {{ date(snapshot.captured_at) }}
这是当时的记录，不代表你现在必须这样想</text>
      <view v-for="(row, index) in rows" :key="index" class="me-answer"><text class="me-answer-label">{{ row.label }}</text><text class="me-answer-value">{{ row.value }}</text></view>
      <button class="me-inline" :disabled="busy" @click="emit('direction')">现在的想法变了？确认新的方向<SvgIcon name="chevron" :size="14" /></button>
      <text class="me-record-note">新的方向单独保存，不改写最初回答或收集日期</text>
      <button class="me-delete-snapshot" :disabled="busy || saving" @click="removeSnapshot" hover-class="pressed">删除这份初始回答</button>
    </view>
    <button class="me-record-row me-journey-entry" @click="journey" hover-class="pressed"><view><text class="me-record-title">走过的路</text><text class="me-record-description">回看{{ current ? '这段探索' : '各段探索' }}中确认留下的记录与变化</text></view><SvgIcon name="arrow-diagonal" :size="17" /></button>
    <text v-if="actionError" class="me-action-error" role="alert">{{ actionError }}</text>
  </view>
</template>
<style scoped lang="scss">
.me-shared-context { margin:12px 0; padding:14px; border:1px solid var(--line); border-radius:8px; background:var(--soft); }
.me-shared-line { display:block; margin:10px 0; font-size:14px; line-height:1.8; white-space:pre-wrap; color:var(--ink); }
.me-records { margin-top:0; font-family:var(--font-body); font-weight:400; }
.me-records button,.me-records text { font-family:var(--font-body); font-weight:400; }
.me-section-heading { display:flex; align-items:center; justify-content:space-between; gap:8px; margin:12px 0 7px; }
.me-section-title { font-size:var(--type-body); font-weight:400; line-height:1.6; color:var(--ink); }
.me-inline { display:inline-flex; align-items:center; gap:4px; min-height:44px; padding:4px 0; font-size:12px; color:var(--accent); line-height:1.6; background:transparent; }
.me-scope,.me-record-meta,.me-record-note { display:block; font-size:12px; line-height:1.75; color:var(--muted); overflow-wrap:anywhere; }
.me-scope { margin-bottom:12px; }
.me-phase-card { padding:16px; border:1px solid var(--line); border-radius:8px; background:var(--paper); }
.me-phase-item + .me-phase-item { border-top:1px solid var(--line); margin-top:12px; padding-top:12px; }
.me-record-copy { display:block; font-size:14px; line-height:1.8; color:var(--ink); white-space:pre-wrap; }
.me-record-meta { margin-top:6px; }
.me-record-row { width:100%; display:flex; align-items:center; justify-content:space-between; gap:16px; padding:15px 0; min-height:66px; border:0; border-bottom:1px solid var(--line); border-radius:0; background:transparent; text-align:left; }
.me-record-row > view:first-child { flex:1; min-width:0; }
.me-record-title { display:block; font-size:14px; line-height:1.6; color:var(--ink); }
.me-record-description { display:block; margin-top:5px; font-size:12px; line-height:1.75; color:var(--muted); overflow-wrap:anywhere; }
.me-record-row .toggle { flex-shrink:0; }
.me-record-note { margin-top:10px; }
.me-past-heading { margin-top:28px; }
.me-records .me-record-row[disabled] { background:transparent; color:var(--ink); }
.me-records .me-snapshot-entry[disabled] { opacity:1; background:transparent; color:var(--ink); }
.me-snapshot-detail { padding:4px 0 16px; border-bottom:1px solid var(--line); }
.me-answer { margin-top:16px; }
.me-answer-label { display:block; font-size:12px; line-height:1.6; color:var(--muted); }
.me-answer-value { display:block; margin-top:4px; font-size:14px; line-height:1.8; color:var(--ink); white-space:pre-wrap; }
.me-delete-snapshot { display:block; min-height:44px; margin-top:10px; font-size:13px; line-height:1.6; color:var(--accent); background:transparent; }
.me-local-error > text { display:block; }
.me-local-error .me-inline { display:flex; text-decoration:underline; text-underline-offset:4px; }
.me-local-error,.me-action-error { color:var(--ink); font-size:13px; line-height:1.8; }
.me-action-error { display:block; margin-top:12px; }
</style>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import SvgIcon from '../../components/SvgIcon.vue'
import { journeyDate, useJourneySession } from '../../journey'
import type { CandidatePage, JourneyCandidate, JourneyEvent } from '../../journey'
import type { Issue } from '../../domain'
const { theme, style, error, loading, capsuleBottom, request, loadSession, setEntryTheme, refreshTheme, back } = useJourneySession()
const recordRequestId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
  const n = Math.floor(Math.random() * 16); return (c === 'x' ? n : (n & 3) | 8).toString(16)
})
const mode = ref('event'), issueId = ref(''), eventId = ref('')
const issue = ref<Issue | null>(null), event = ref<JourneyEvent | null>(null)
const candidates = ref<JourneyCandidate[]>([]), nextOffset = ref<number | null>(null)
const selected = ref<JourneyCandidate | null>(null), editing = ref(false), sourceOpen = ref(false)
const busy = ref(false), title = ref(''), text = ref(''), kindIndex = ref(0), loaded = ref(false)
const kinds = ['thought', 'decision', 'change', 'action', 'pause'] as const
const labels = ['一个想法', '一次选择', '想法变化', '一次行动', '选择暂停']
const pageTitle = computed(() => mode.value === 'direction' ? '接下来，我愿意' : mode.value === 'pending' ? '待确认的时刻' : mode.value === 'new' ? '留下一刻' : event.value?.title || '一个重要的时刻')
const formVisible = computed(() => mode.value === 'new' || mode.value === 'direction' || !!selected.value || editing.value)
const canSave = computed(() => !busy.value && !loading.value && (mode.value === 'direction' || (!!title.value.trim() && !!text.value.trim())))

async function pendingPage(offset = 0) {
  const data = await request<CandidatePage>('GET', '/journey/candidates?offset=' + offset + (issueId.value ? '&issue_id=' + encodeURIComponent(issueId.value) : ''))
  candidates.value = offset ? [...candidates.value, ...data.items] : data.items
  nextOffset.value = data.next_offset
}
async function load() {
  if (loading.value) return
  loading.value = true; error.value = ''
  try {
    await loadSession()
    if (mode.value === 'pending') await pendingPage()
    else if (mode.value === 'event') {
      event.value = await request<JourneyEvent>('GET', '/journey/events/' + encodeURIComponent(eventId.value))
      issueId.value = event.value.issue_id
    } else {
      issue.value = await request<Issue>('GET', '/issues/' + encodeURIComponent(issueId.value))
      if (mode.value === 'direction') text.value = issue.value.card.next_step
    }
    loaded.value = true
  } catch (err) { error.value = err instanceof Error ? err.message : '暂时无法读取这条记录' }
  finally { loading.value = false }
}
function selectCandidate(value: JourneyCandidate) {
  selected.value = value; title.value = value.title; text.value = value.text; kindIndex.value = 0; error.value = ''
}
function edit() {
  if (!event.value) return
  title.value = event.value.title; text.value = event.value.text; editing.value = true; error.value = ''
}
async function save() {
  if (!canSave.value) return
  busy.value = true; error.value = ''
  try {
    if (mode.value === 'direction') {
      if (!issue.value) return
      await request('PUT', '/journey/directions/' + encodeURIComponent(issueId.value), { version: issue.value.version, next_step: text.value.trim() })
    } else if (editing.value && event.value) {
      event.value = await request<JourneyEvent>('PUT', '/journey/events/' + encodeURIComponent(event.value.id), { title: title.value.trim(), text: text.value.trim(), version: event.value.version })
      uni.$emit('agency:journey-changed')
      editing.value = false
      uni.showToast({ title: '记录已修正', icon: 'none' }); return
    } else {
      await request('POST', '/journey/records', { request_id: recordRequestId, issue_id: selected.value?.issue_id || issueId.value, kind: kinds[kindIndex.value], title: title.value.trim(), text: text.value.trim(), ...(selected.value ? { source_message_id: selected.value.id, source_version: selected.value.source_version } : {}) })
    }
    uni.$emit('agency:journey-changed')
    uni.showToast({ title: mode.value === 'direction' ? '方向已保存' : '这一刻已留下', icon: 'none' })
    back()
  } catch (err) { error.value = err instanceof Error ? err.message : '没有保存成功，你的文字仍保留' }
  finally { busy.value = false }
}
async function dismiss(value: JourneyCandidate) {
  if (busy.value) return
  busy.value = true; error.value = ''
  try {
    await request('POST', '/journey/candidates/' + encodeURIComponent(value.id) + '/dismiss', { source_version: value.source_version })
    candidates.value = candidates.value.filter(item => item.id !== value.id)
    selected.value = null
    // Removing a result shifts the offset in the remaining message scan.
    if (nextOffset.value !== null) nextOffset.value = Math.max(0, nextOffset.value - 1)
    uni.showToast({ title: '已略过这条线索', icon: 'none' })
  } catch (err) { error.value = err instanceof Error ? err.message : '暂时没有完成，请稍后重试' }
  finally { busy.value = false }
}
async function remove() {
  if (busy.value || !event.value) return
  const answer = await new Promise<boolean>(resolve => uni.showModal({ title: '删除这条记录？', content: '删除后不会再出现在正式时间轴里', success: result => resolve(result.confirm), fail: () => resolve(false) }))
  if (!answer) return
  busy.value = true; error.value = ''
  try {
    await request('DELETE', '/journey/events/' + encodeURIComponent(event.value.id) + '?version=' + encodeURIComponent(event.value.version || ''))
    uni.$emit('agency:journey-changed')
    uni.showToast({ title: '这条记录已删除', icon: 'none' }); back()
  } catch (err) { error.value = err instanceof Error ? err.message : '暂时无法删除' }
  finally { busy.value = false }
}
async function moreCandidates() {
  if (nextOffset.value === null || busy.value) return
  busy.value = true; error.value = ''
  try { await pendingPage(nextOffset.value) }
  catch (err) { error.value = err instanceof Error ? err.message : '暂时无法读取' }
  finally { busy.value = false }
}
onLoad(options => {
  setEntryTheme(options?.theme)
  const requested = options?.mode || 'event'
  mode.value = ['new', 'direction', 'pending'].includes(requested) ? requested : 'event'
  try {
    issueId.value = decodeURIComponent(options?.issue || '')
    eventId.value = decodeURIComponent(options?.id || '')
  } catch { error.value = '记录地址不完整，请返回后重新打开'; return }
  void load()
})
onShow(() => refreshTheme())
</script>
<template>
  <view class="journey-page preview-stage journey-detail" :class="'theme-' + theme.id" :style="{ ...style, '--journey-top': capsuleBottom + 'px' }">
    <view class="journey-nav"><button class="journey-back" :disabled="busy" aria-label="返回走过的路" @click="back" hover-class="journey-pressed" :hover-start-time="0"><SvgIcon name="back" :size="23" /></button></view>
    <view class="journey-body journey-detail-body">
      <text class="journey-kicker">{{ mode === 'pending' ? 'A MOMENT TO REVIEW' : 'A PART OF YOUR JOURNEY' }}</text>
      <text class="journey-detail-title">{{ pageTitle }}</text>
      <view v-if="error" class="journey-error"><text>{{ error }}</text><button v-if="!loaded" class="journey-link" :disabled="loading" @click="load">重新读取</button></view>
      <text v-if="loading && !loaded" class="journey-empty">正在读取记录</text>
      <template v-if="loaded">
        <template v-if="mode === 'pending' && !selected">
          <text class="journey-copy">这些是 AI 发现的线索，还不是已经发生的事实。你可以修改后留下，也可以略过。</text>
          <view v-for="value in candidates" :key="value.id" class="journey-candidate">
            <text class="journey-caption">{{ journeyDate(value.created_at) }} · 待你确认</text>
            <text class="journey-copy">{{ value.text }}</text>
            <text v-if="value.uncertainty" class="journey-caption">{{ value.uncertainty }}</text>
            <view class="journey-actions"><button class="journey-link" :disabled="busy" @click="selectCandidate(value)">审阅并决定<SvgIcon name="arrow" :size="16" /></button><button class="journey-link" :disabled="busy" @click="dismiss(value)">不留下</button></view>
          </view>
          <text v-if="!candidates.length" class="journey-empty">这里没有等待确认的线索\n值得留下什么，仍由你决定</text>
          <button v-if="nextOffset !== null" class="journey-link" :disabled="busy" @click="moreCandidates">{{ busy ? '正在读取' : '看看更早的线索' }}</button>
        </template>
        <template v-if="mode === 'event' && event && !editing">
          <text class="journey-caption">{{ journeyDate(event.created_at) }} · 已确认</text>
          <text class="journey-detail-topic">{{ event.issue_title || '这段探索' }}</text>
          <text class="journey-detail-text">{{ event.text }}</text>
          <button class="journey-source-toggle" :aria-expanded="sourceOpen" @click="sourceOpen = !sourceOpen" hover-class="journey-pressed" :hover-start-time="0"><text>{{ event.source_label }}</text><SvgIcon name="chevron" :size="15" /></button>
          <view v-if="sourceOpen" class="journey-source"><text class="journey-copy">{{ event.source_text || (event.source_available ? event.text : '原始会话已不可用，你独立确认的记录仍然保留') }}</text></view>
          <view v-if="event.editable" class="journey-actions"><button class="journey-link" @click="edit" :disabled="busy">修正这条记录</button><button class="journey-link" @click="remove" :disabled="busy">删除</button></view>
        </template>
        <view v-if="formVisible" class="journey-form">
          <text v-if="issue" class="journey-caption">{{ issue.title || '这段探索' }}</text>
          <text v-if="selected" class="journey-copy">这段内容来自 AI，请先核对和修改。确认保存后，才会成为你留下的记录。</text>
          <template v-if="mode !== 'direction'">
            <text class="journey-field-label">这一刻，属于</text>
            <picker v-if="!editing" :range="labels" :value="kindIndex" :disabled="busy" @change="kindIndex = Number($event.detail.value)"><view class="journey-select">{{ labels[kindIndex] }}<SvgIcon name="chevron" :size="16" /></view></picker>
            <text class="journey-field-label">给这一刻一个名字</text>
            <input v-model="title" class="journey-input" :disabled="busy || (editing && event?.id.startsWith('feedback:'))" :maxlength="120" placeholder="一个以后还想回看的时刻" />
          </template>
          <text class="journey-field-label">{{ mode === 'direction' ? '我愿意保留的下一步' : '想留下的内容' }}</text>
          <textarea v-model="text" class="journey-textarea" :disabled="busy" :maxlength="mode === 'direction' ? 600 : 2000" :auto-height="true" :adjust-position="true" :cursor-spacing="100" :placeholder="mode === 'direction' ? '想尝试什么，可以先写在这里' : '发生了什么，或你的想法有什么变化'" />
          <text class="journey-caption">{{ mode === 'direction' ? '可以改变，也可以清空后保存，暂时放下这一步' : '按本次保存时间留下，不会把想法自动写成已完成的行动' }}</text>
          <button class="journey-save" :disabled="!canSave || !!issue?.ended_at && mode === 'direction'" @click="save" hover-class="journey-pressed" :hover-start-time="0">{{ busy ? '正在保存' : mode === 'direction' ? '保存我选择的方向' : '确认并保存' }}</button>
          <button v-if="selected" class="journey-link" :disabled="busy" @click="selected = null; error = ''">暂不保存</button>
          <button v-if="editing" class="journey-link" :disabled="busy" @click="editing = false; error = ''">取消修改</button>
        </view>
      </template>
    </view>
  </view>
</template>
<style lang="scss" src="./journey.scss"></style>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import SvgIcon from '../../components/SvgIcon.vue'
import { resolvePageArt } from '../../page-art'
import { journeyDate, mergeJourneyEvents, reflectionFor, shortJourneyDate, useJourneySession } from '../../journey'
import type { CandidatePage, JourneyEvent, JourneyPage } from '../../journey'
import type { Issue } from '../../domain'
const { theme, style, error, loading, capsuleBottom, request, loadSession, setEntryTheme, back } = useJourneySession()
const issues = ref<Issue[]>([]), events = ref<JourneyEvent[]>([]), cursor = ref<string | null>(null)
const selectedIssue = ref(''), pendingCount = ref(0), pendingOffset = ref<number | null>(null)
const loaded = ref(false), moreBusy = ref(false), navigating = ref(false)
const selectedIndex = computed(() => Math.max(0, issues.value.findIndex(item => item.id === selectedIssue.value) + 1))
const issueLabels = computed(() => ['全部探索', ...issues.value.map(item => item.title || '未命名的探索')])
const reflection = computed(() => reflectionFor(events.value, issues.value))
const activeIssue = computed(() => issues.value.find(item => !item.ended_at && (!selectedIssue.value || item.id === selectedIssue.value)))
const directions = computed(() => issues.value.filter(item => !item.ended_at && item.card.next_step.trim() && (!selectedIssue.value || item.id === selectedIssue.value)))
const hero = computed(() => resolvePageArt(theme.value.id).discover)
const query = () => selectedIssue.value ? 'issue_id=' + encodeURIComponent(selectedIssue.value) + '&' : ''
let refreshQueued = false
async function load(reset = true) {
  if (loading.value || moreBusy.value) { if (reset) refreshQueued = true; return }
  if (reset) loading.value = true
  else moreBusy.value = true
  error.value = ''
  try {
    await loadSession()
    if (reset) {
      const all: Issue[] = []
      for (let offset = 0; ; offset += 100) {
        const page = await request<Issue[]>('GET', '/issues?limit=100&offset=' + offset)
        all.push(...page)
        if (page.length < 100) break
      }
      issues.value = all
      if (selectedIssue.value && !all.some(item => item.id === selectedIssue.value)) selectedIssue.value = ''
    }
    const page = await request<JourneyPage>('GET', '/journey/events?' + query() + (reset || !cursor.value ? '' : 'before=' + encodeURIComponent(cursor.value)))
    const target = reset ? events.value.length : 0
    let collected = reset ? page.items : mergeJourneyEvents(events.value, page.items)
    let next = page.next_cursor
    while (reset && next && collected.length < target) {
      const older = await request<JourneyPage>('GET', '/journey/events?' + query() + 'before=' + encodeURIComponent(next))
      collected = mergeJourneyEvents(collected, older.items); next = older.next_cursor
    }
    events.value = collected
    cursor.value = next
    if (reset) {
      const pending = await request<CandidatePage>('GET', '/journey/candidates?' + query())
      pendingCount.value = pending.items.length
      pendingOffset.value = pending.next_offset
      loaded.value = true
    }
  } catch (err) { error.value = err instanceof Error ? err.message : '暂时无法读取记录，请稍后重试' }
  finally {
    loading.value = false; moreBusy.value = false
    if (refreshQueued) { refreshQueued = false; void load() }
  }
}
function filter(event: { detail: { value: string | number } }) {
  if (loading.value || moreBusy.value) return
  selectedIssue.value = issues.value[Number(event.detail.value) - 1]?.id || ''
  void load()
}
function open(path: string) {
  if (navigating.value) return
  navigating.value = true
  uni.navigateTo({ url: path + (path.includes('?') ? '&' : '?') + 'theme=' + theme.value.id, complete: () => { navigating.value = false } })
}
function record() {
  const id = selectedIssue.value || activeIssue.value?.id || issues.value[0]?.id
  if (id) open('/pages/journey/detail?mode=new&issue=' + encodeURIComponent(id))
}
function openDirection(id: string) { open('/pages/journey/detail?mode=direction&issue=' + encodeURIComponent(id)) }
onLoad(options => { setEntryTheme(options?.theme) })
onShow(() => { void load() })
</script>
<template>
  <view class="journey-page preview-stage" :class="'theme-' + theme.id" :style="{ ...style, '--journey-top': capsuleBottom + 'px' }">
    <view class="journey-scene" aria-hidden="true"><image :src="hero" mode="aspectFill" /><view /></view>
    <view class="journey-nav"><button class="journey-back" aria-label="返回发现" @click="back" hover-class="journey-pressed" :hover-start-time="0"><SvgIcon name="back" :size="23" /></button></view>
    <view class="journey-body">
      <view class="journey-intro"><text class="journey-kicker">YOUR JOURNEY</text><text class="journey-title">走过的路</text><text class="journey-subtitle">那些重要的时刻，都还在这里</text><view class="journey-rule" /></view>
      <view v-if="error" class="journey-error"><text>{{ error }}</text><button class="journey-link" :disabled="loading" @click="load()">重新读取</button></view>
      <text v-if="loading && !loaded" class="journey-empty">正在翻开你留下的记录</text>
      <template v-if="loaded">
        <view class="journey-reflection">
          <text class="journey-section-title">此刻回望</text><view class="journey-rule small" />
          <template v-if="reflection"><text class="journey-copy">{{ reflection.introduction }}</text><text class="journey-quote">{{ reflection.quote }}</text><text class="journey-caption">{{ reflection.date }} · 你确认留下的内容</text></template>
          <text v-else class="journey-copy">等有了值得回望的记录，再慢慢连起这段经历。此刻不必急着为自己写一个总结。</text>
        </view>
        <view class="journey-section-head"><text class="journey-section-title">重要的时刻</text><button v-if="issues.length" class="journey-link" @click="record" hover-class="journey-pressed" :hover-start-time="0"><SvgIcon name="plus" :size="15" />留下一刻</button></view>
        <view class="journey-filter">
          <picker :range="issueLabels" :value="selectedIndex" :disabled="loading || moreBusy" @change="filter"><view class="journey-filter-label"><text>{{ issueLabels[selectedIndex] }}</text><SvgIcon name="chevron" :size="14" tone="muted" /></view></picker>
          <text class="journey-caption">已确认 · 按记录时间</text>
        </view>
        <view class="journey-timeline" :class="{ 'journey-updating': loading }">
          <button v-for="item in events" :key="item.id" class="journey-event" :data-event-id="item.id" @click="open('/pages/journey/detail?id=' + encodeURIComponent(item.id))" hover-class="journey-pressed" :hover-start-time="0">
            <text class="journey-event-date">{{ shortJourneyDate(item.created_at) }}<text class="journey-event-year">{{ journeyDate(item.created_at).split('年')[0] }}</text></text>
            <view class="journey-track"><view class="journey-dot" :class="{ 'journey-dot-latest': item.id === events[0]?.id }" /></view>
            <view class="journey-event-copy"><text class="journey-event-title">{{ item.title }}</text><text v-if="!selectedIssue && issues.length > 1" class="journey-caption journey-event-topic">{{ item.issue_title || '未命名的探索' }}</text><text class="journey-event-excerpt">{{ item.text }}</text></view>
            <SvgIcon name="chevron" :size="14" tone="muted" />
          </button>
        </view>
        <text v-if="!events.length" class="journey-empty">这里还没有你选择留下的时刻\n有了想法、选择或一次尝试，再把它留在这里</text>
        <button v-if="cursor" class="journey-link journey-more" :disabled="loading || moreBusy" @click="load(false)">{{ moreBusy ? '正在读取' : '再往前看看' }}</button>
        <button v-if="pendingCount || pendingOffset !== null" class="journey-pending-entry" @click="open('/pages/journey/detail?mode=pending' + (selectedIssue ? '&issue=' + encodeURIComponent(selectedIssue) : ''))" hover-class="journey-pressed" :hover-start-time="0"><view><text>待确认的时刻</text><text class="journey-caption">看看 AI 发现的线索，由你决定是否留下</text></view><SvgIcon name="arrow" :size="18" tone="accent" /></button>
        <view class="journey-section-head"><text class="journey-section-title">接下来</text></view>
        <button v-for="issue in directions" :key="issue.id" class="journey-direction" @click="openDirection(issue.id)" hover-class="journey-pressed" :hover-start-time="0"><view class="journey-direction-copy"><text class="journey-caption">{{ issue.title || '这段探索' }}</text><text class="journey-direction-text">{{ issue.card.next_step }}</text></view><view class="journey-direction-arrow"><SvgIcon name="arrow" :size="20" tone="accent" /></view></button>
        <view v-if="!directions.length" class="journey-future-empty"><text class="journey-copy">还没有想好下一步，也没关系\n等你愿意时，再留一个想去的方向</text><button v-if="activeIssue" class="journey-link" @click="openDirection(activeIssue.id)" hover-class="journey-pressed" :hover-start-time="0">留下一个方向<SvgIcon name="arrow" :size="16" /></button></view>
        <view class="journey-footer"><SvgIcon name="leaf" :size="21" tone="accent" /><text>成长不一定有清晰的刻度</text></view>
      </template>
    </view>
  </view>
</template>
<style lang="scss" src="./journey.scss"></style>

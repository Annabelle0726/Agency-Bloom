<script setup lang="ts">
import SvgIcon from '../../../components/SvgIcon.vue'
import { iconSources } from '../../../icons'
import type { Card, Issue } from '../../../domain'
import { editFields, prettyDate } from '../data'

defineOptions({ options: { styleIsolation: 'apply-shared' } })

defineProps<{
  current: Issue
  card: Card
}>()
const emit = defineEmits<{
  openEditor: []
  feedback: []
  chat: []
  resume: []
  end: []
}>()
</script>

<template>
  <view class="workspace plan-content">
    <view class="section-intro"><text class="eyebrow">ONE SMALL STEP</text><text class="page-title">{{ '为下一步\n留一点空间' }}</text><text class="page-description">这里保留你确认的方向、行动和新的发现</text></view>
    <view v-if="!card.next_step" class="plan-empty glass-card"><text class="card-title">还没有决定下一步，也没关系</text><text class="body-copy">先写下一件愿意试的事，或和我一起想一想</text><button class="text-button" @click="emit('openEditor')">整理我的卡片 <SvgIcon name="arrow" :size="17" /></button><button class="text-button" @click="emit('chat')">一起聊聊 <SvgIcon name="chat" :size="17" /></button></view>
    <view v-if="card.next_step" class="next-card">
      <text class="eyebrow">我愿意尝试的下一步</text>
      <text class="next-title">{{ card.next_step }}</text>
      <button class="text-button" @click="emit('feedback')" hover-class="pressed" :hover-start-time="0"
              :hover-stay-time="70">记下后来的变化
        <SvgIcon name="arrow" :size="17"/>
      </button>
    </view>
    <view class="section-row">
      <text class="section-title">我的决策卡</text>
      <button class="text-button" @click="emit('openEditor')" hover-class="pressed" :hover-start-time="0"
              :hover-stay-time="70">编辑
        <SvgIcon name="arrow-diagonal" :size="17"/>
      </button>
    </view>
    <view class="paper-card">
      <view class="paper-top">
        <text class="eyebrow">正在跟进</text>
        <view class="live-dot"/>
      </view>
      <text class="card-title">{{ card.title || '这次探索，还可以继续' }}</text>
      <view class="card-rule"/>
      <view v-for="field in editFields" :key="field.key" class="card-section">
        <text class="card-label" :class="field.key">{{ field.label }}</text>
        <text v-for="(line, index) in card[field.key]" :key="index" class="card-line">{{ line }}</text>
        <text v-if="!card[field.key].length" class="muted small">
          {{ field.key === 'options' ? '先探索，再慢慢形成选项' : '等你愿意时，再补充' }}
        </text>
      </view>
      <view class="paper-footer">
        <text>由你确认 · 随时可改</text>
        <text>{{ prettyDate(current.updated_at) }}</text>
      </view>
    </view>
    <view class="section-row">
      <text class="section-title">一路上的变化</text>
      <button class="text-button" @click="emit('feedback')" hover-class="pressed" :hover-start-time="0"
              :hover-stay-time="70">
        <SvgIcon name="plus" :size="15"/>
        记录
      </button>
    </view>
    <view v-if="!current.feedback.length" class="home-empty">
      <image class="home-entry-glyph" :src="iconSources.note.ink" mode="aspectFit"/>
      <text>每一点新的发现，都可以留在这里</text>
    </view>
    <view v-for="entry in current.feedback" :key="entry.id" class="timeline-entry">
      <view class="timeline-dot"/>
      <view>
        <text class="muted small">{{ prettyDate(entry.created_at) }} ·
          {{ entry.kind === 'progress' ? '有了新进展' : entry.kind === 'stuck' ? '遇到一点阻碍' : '想法变了' }}
        </text>
        <text class="body-copy">{{ entry.text }}</text>
      </view>
    </view>
    <button v-if="current.ended_at" class="secondary" @click="emit('resume')">恢复这个探索</button>
    <button v-else class="text-button end-link" @click="emit('end')" hover-class="pressed" :hover-start-time="0"
            :hover-stay-time="70">结束这件事，给新的方向留空间
    </button>
  </view>
</template>

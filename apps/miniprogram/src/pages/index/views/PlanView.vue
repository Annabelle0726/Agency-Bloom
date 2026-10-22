<script setup lang="ts">
import { computed } from 'vue'
import SvgIcon from '../../../components/SvgIcon.vue'
import { iconSources } from '../../../icons'
import type { Card, Issue } from '../../../domain'
import { editFields, prettyDate } from '../data'
import { resolvePageArt, visibleDecisionFields } from '../../../page-art'
import { resolvePlanVisual } from '../../../visual-library'
defineOptions({ options: { styleIsolation: 'apply-shared' } })
const props = defineProps<{ current: Issue; card: Card; themeId: string }>()
const art = computed(() => resolvePageArt(props.themeId))
const decisionVisual = computed(() => resolvePlanVisual(props.themeId))
const hasFields = computed(() => visibleDecisionFields(props.card).length > 0)
const sprout = computed(() => props.themeId === 'dark' ? '/static/brand-sprout-night.png' : '/static/brand-sprout.png')
const fieldMeta: Record<(typeof editFields)[number]['key'], { icon: string; hint: string }> = {
  options: { icon: 'paths', hint: '先探索，再慢慢形成选项' },
  constraints: { icon: 'scale', hint: '等你准备时，再补充' },
  confirmed: { icon: 'shield-check', hint: '等你准备时，再补充' },
  hypotheses: { icon: 'spark', hint: '等你整理一些想法后，我们再一起看看' },
  unknowns: { icon: 'compass', hint: '等有具体疑问时，再一起核实' },
}
const emit = defineEmits<{ openEditor: []; feedback: []; chat: []; resume: []; end: [] }>()
</script>

<template>
  <view class="workspace plan-content bloom-content">
    <view class="bloom-hero" aria-hidden="true">
      <image class="bloom-hero-image" :src="art.plan" mode="aspectFill" />
      <view class="bloom-hero-wash" />
    </view>
    <view class="section-intro bloom-intro">
      <text class="eyebrow">ONE SMALL STEP</text>
      <text class="page-title plan-title">为下一步，留一点空间</text>
      <text class="page-description">这里保留你确认的方向、行动和新的发现</text>
    </view>
    <view v-if="!card.next_step" class="plan-empty bloom-surface">
      <view class="plan-empty-main">
        <image class="plan-empty-sprout" :src="sprout" mode="aspectFit" aria-hidden="true" />
        <view class="plan-empty-copy">
          <text class="card-title">还没有决定下一步，也没关系</text>
          <text class="body-copy">先写下一个想聊的事情，或和我一起想一想</text>
        </view>
        <button class="plan-empty-arrow" @click="emit('openEditor')" hover-class="pressed" :hover-start-time="0" aria-label="整理我的卡片">
          <SvgIcon name="arrow" :size="18" tone="accent" />
        </button>
      </view>
      <view class="plan-empty-actions">
        <button class="text-button with-icon" @click="emit('openEditor')" hover-class="pressed" :hover-start-time="0">整理我的卡片 <SvgIcon name="arrow" :size="17" /></button>
        <button class="text-button with-icon" @click="emit('chat')" hover-class="pressed" :hover-start-time="0">一起聊聊 <SvgIcon name="chat" :size="17" /></button>
      </view>
    </view>
    <view v-else class="next-card bloom-surface">
      <text class="eyebrow">我愿意尝试的下一步</text>
      <text class="next-title">{{ card.next_step.split('\n')[0] }}</text>
      <text v-for="(line, index) in card.next_step.split('\n').slice(1)" :key="index" class="next-detail">{{ line }}</text>
      <button class="text-button with-icon" @click="emit('feedback')" hover-class="pressed" :hover-start-time="0">记下后来的变化 <SvgIcon name="arrow" :size="17" /></button>
    </view>
    <view class="section-row">
      <text class="section-title">我的决策卡</text>
      <button class="text-button with-icon" @click="emit('openEditor')" hover-class="pressed" :hover-start-time="0">编辑 <SvgIcon name="arrow-diagonal" :size="17" /></button>
    </view>
    <view class="paper-card bloom-decision">
      <view class="decision-heading">
        <view class="decision-heading-copy">
          <view class="paper-top">
            <view class="live-dot" />
            <text class="eyebrow">{{ current.ended_at ? '已结束' : '正在探索' }}</text>
          </view>
          <text class="card-title">{{ card.title || '这次探索，还可以继续' }}</text>
          <text v-if="!hasFields" class="decision-subtitle">不着急给出一个最终答案。</text>
        </view>
        <image v-if="decisionVisual" class="decision-photo" :src="decisionVisual.src" mode="aspectFill" aria-hidden="true" />
        <view v-else class="decision-photo decision-photo-empty" aria-hidden="true" />
      </view>
      <view class="decision-rows">
        <button v-for="field in editFields" :key="field.key" class="decision-row"
                @click="emit('openEditor')" hover-class="pressed" :hover-start-time="0"
                :aria-label="'编辑' + field.label">
          <view class="decision-row-icon" :class="field.key">
            <SvgIcon :name="fieldMeta[field.key].icon" :size="18" tone="accent" />
          </view>
          <view class="decision-row-copy">
            <text class="decision-row-label">{{ field.label }}</text>
            <template v-if="card[field.key].length">
              <text v-for="(line, index) in card[field.key]" :key="index" class="card-line">{{ line }}</text>
            </template>
            <text v-else class="decision-row-hint">{{ fieldMeta[field.key].hint }}</text>
          </view>
          <SvgIcon name="chevron" :size="16" tone="muted" />
        </button>
      </view>
      <view v-if="hasFields" class="paper-footer">
        <text>由你确认 · 随时可改</text>
        <text>{{ prettyDate(current.updated_at) }}</text>
      </view>
    </view>
    <view class="section-row">
      <text class="section-title">一路上的变化</text>
      <button class="text-button with-icon" @click="emit('feedback')" hover-class="pressed" :hover-start-time="0"><SvgIcon name="plus" :size="15" />记录</button>
    </view>
    <view v-if="!current.feedback.length" class="home-empty">
      <image class="home-entry-glyph" :src="iconSources.note.ink" mode="aspectFit" />
      <text>有了新的发现，就记在这里</text>
    </view>
    <view v-for="entry in current.feedback" :key="entry.id" class="timeline-entry">
      <view class="timeline-dot" />
      <view>
        <text class="muted small">{{ prettyDate(entry.created_at) }} · {{ entry.kind === 'progress' ? '有了新进展' : entry.kind === 'stuck' ? '遇到一点阻碍' : '想法变了' }}</text>
        <text class="body-copy">{{ entry.text }}</text>
      </view>
    </view>
    <button v-if="current.ended_at" class="secondary" @click="emit('resume')">恢复这个探索</button>
    <button v-else class="text-button end-link" @click="emit('end')" hover-class="pressed" :hover-start-time="0">结束这件事，给新的方向留空间</button>
  </view>
</template>

<script setup lang="ts">
import SvgIcon from '../../../components/SvgIcon.vue'
import { computed } from 'vue'
import HomeBloomCard from '../../../components/HomeBloomCard.vue'
import { homeQuote } from '../../../use-home-quote'
import { homeEntryFor } from '../../../home-entry'
import type { Card, Conversation, Issue } from '../../../domain'

defineOptions({ options: { styleIsolation: 'apply-shared' } })

const props = withDefaults(defineProps<{
  card: Card
  current: Issue | null
  greeting: string
  todayLabel: string
  conversation: Conversation | null
  retainChat: boolean
  openingChat: boolean
  foreground?: boolean
}>(),{foreground:true})
const entry = computed(() => homeEntryFor(props.current, props.card, props.conversation, props.retainChat))
const emit = defineEmits<{
  openEditor: []
  plan: []
  feedback: []
  chat: []
  onboarding: []
}>()
</script>

<template>
  <view class="workspace home-dashboard">
    <view class="home-heading hero-heading">
      <view class="hero-kicker"><view class="hero-dot" aria-hidden="true"/><text class="hero-eyebrow">{{ greeting }}</text></view>
      <text class="hero-title">欢迎回到你的生活</text>
      <view class="hero-lower">
        <text class="hero-subtitle">{{ '每一次选择\n都可以更靠近自己的意愿' }}</text>
        <text class="hero-aside">{{ '远处有方向\n此刻也有生活' }}</text>
      </view>
    </view>
    <HomeBloomCard :entry="entry" :has-concern="!!current" :busy="openingChat" :foreground="foreground !== false" @continue="emit('chat')" @details="emit('openEditor')" />
    <view v-if="current" class="home-focus-card glass-card">
      <view class="focus-card-heading"><text>今日聚焦</text><text>{{ todayLabel }}</text></view>
      <button class="focus-row" data-home="plan" @click="emit('plan')" hover-class="pressed" :hover-start-time="0">
        <view class="focus-symbol"><SvgIcon name="step" :size="18" tone="accent" /></view>
        <view class="focus-row-copy"><text>{{ card.next_step || '找到一个愿意尝试的小改变' }}</text><text>{{ card.next_step ? '你已确认的下一步，随时可以调整' : '从时间和精力允许的一步开始' }}</text></view><text class="focus-tag focus-tag-plan">计划</text>
      </button>
      <button class="focus-row" data-home="reflect" @click="emit('feedback')" hover-class="pressed" :hover-start-time="0">
        <view class="focus-symbol"><SvgIcon name="note" :size="18" tone="accent" /></view>
        <view class="focus-row-copy"><text>留意今天的真实感受</text><text>一点发现，或只是想停一停</text></view><text class="focus-tag focus-tag-reflect">记录</text>
      </button>
      <button class="focus-row" data-home="chat" @click="emit('chat')" hover-class="pressed" :hover-start-time="0">
        <view class="focus-symbol"><SvgIcon name="chat" :size="18" tone="accent" /></view>
        <view class="focus-row-copy"><text>把挂心的事，慢慢说清楚</text><text>接着上一次，也可以换个话题</text></view><text class="focus-tag focus-tag-chat">对话</text>
      </button>
    </view>
    <button v-if="!current" class="home-onboarding-link" hover-class="pressed" :hover-start-time="0" @click="emit('onboarding')">也可以先整理一点自己的情况 <SvgIcon name="chevron" :size="13" tone="muted" /></button>
    <view class="home-quote">
      <view class="quote-body">
        <text class="quote-eyebrow">留一句给自己</text>
        <view class="quote-passage">
          <text class="quote-mark quote-open" aria-hidden="true">“</text>
          <text class="quote-text">{{ homeQuote.text }}</text>
          <text class="quote-mark quote-close" aria-hidden="true">”</text>
        </view>
        <view class="quote-footer"><text class="quote-signature">{{ homeQuote.source }}</text></view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.home-heading.hero-heading { min-height:185px; }
.hero-aside { transform:translateY(-16px) rotate(-6deg); }
.home-onboarding-link { display:flex; align-items:center; justify-content:center; gap:5px; min-height:44px; margin:0 0 18px; padding:0; font-size:12px; color:var(--muted); background:transparent; }
.home-onboarding-link::after { border:0; }
</style>

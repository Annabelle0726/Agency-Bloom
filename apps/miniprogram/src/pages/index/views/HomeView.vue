<script setup lang="ts">
import SvgIcon from '../../../components/SvgIcon.vue'
import { computed } from 'vue'
import HomeBloomCard from '../../../components/HomeBloomCard.vue'
import HomeRecordsCard from '../../../components/HomeRecordsCard.vue'
import { homeQuote } from '../../../use-home-quote'
import { homeEntryFor, type HomeReply } from '../../../home-entry'
import { resolveHomeRecordVisual } from '../../../home-visual'
import type { ThemeId } from '../../../themes'
import type { Card, Conversation, Issue } from '../../../domain'

defineOptions({ options: { styleIsolation: 'apply-shared' } })

const props = withDefaults(defineProps<{
  card: Card
  current: Issue | null
  greeting: string
  todayLabel: string
  conversation: Conversation | null
  reply?: HomeReply | null
  retainChat: boolean
  openingChat: boolean
  foreground?: boolean
  themeId: ThemeId
}>(),{foreground:true})
const entry = computed(() => homeEntryFor(props.current, props.card, props.conversation, props.retainChat, props.reply))
const recordVisual=computed(()=>resolveHomeRecordVisual(props.current,props.themeId))
const emit = defineEmits<{
  openEditor: []
  plan: []
  feedback: []
  chat: []
  onboarding: []
  context: []
}>()
</script>

<template>
  <view class="workspace home-dashboard">
    <view class="home-heading hero-heading">
      <view class="hero-kicker"><view class="hero-dot" aria-hidden="true"/><text class="hero-eyebrow">{{ greeting }}</text></view>
      <text class="hero-title">欢迎回到你的生活</text>
      <view class="hero-lower">
        <text class="hero-subtitle">{{ '每一次选择\n都可以更靠近自己的意愿' }}</text>
      </view>
    </view>
    <HomeBloomCard :entry="entry" :has-concern="!!current" :busy="openingChat" :foreground="foreground !== false" @continue="emit('chat')" @details="emit('openEditor')" @context="emit('context')" />
    <HomeRecordsCard v-if="current" :issue="current" :visual="recordVisual" :exclude="[entry.title,entry.detail]" @plan="emit('plan')" @feedback="emit('feedback')" />
    <button v-if="!current" class="home-onboarding-link" hover-class="pressed" :hover-start-time="0" @click="emit('onboarding')">也可以先整理一点自己的情况 <SvgIcon name="chevron" :size="13" tone="muted" /></button>
    <view class="home-quote" data-home="quotation">
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
.home-heading.hero-heading { min-height:152px; }
.hero-heading .hero-title { font-size:22px; line-height:33px; }
.home-quote { border-radius:8px; }
.home-onboarding-link { display:flex; align-items:center; justify-content:center; gap:5px; min-height:44px; margin:0 0 18px; padding:0; font-size:12px; color:var(--muted); background:transparent; }
.home-onboarding-link::after { border:0; }
</style>

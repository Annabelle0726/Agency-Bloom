<script setup lang="ts">
import StartActions from '../../../components/StartActions.vue'
import SvgIcon from '../../../components/SvgIcon.vue'
import PlanAtmosphere from '../../../components/PlanAtmosphere.vue'
import type { SpaceTab } from '../../../themes'

defineOptions({ options: { styleIsolation: 'apply-shared' } })

defineProps<{
  tab: SpaceTab
  busy: boolean
}>()
const emit = defineEmits<{ onboarding: []; history: []; chat: [] }>()
</script>

<template>
  <view class="workspace empty-dashboard" :class="{ 'home-dashboard': tab === 'now', 'plan-empty-content': tab === 'plan' }">
    <PlanAtmosphere v-if="tab === 'plan'" />
    <view class="home-heading" :class="{ 'hero-heading': tab === 'now' }">
      <text class="page-title">{{ '先在这里\n给自己一点空间' }}</text>
      <text class="page-description">{{ '不必立刻回答所有问题\n等你愿意时，我们从一件小事开始' }}</text>
    </view>
    <view class="paper-card">
      <text class="eyebrow">按自己的节奏</text>
      <text class="card-title">最近，什么最让你挂心？</text>
      <text class="body-copy">可以直接聊聊，也可以先用几个问题整理起点</text>
      <StartActions :disabled="busy" @chat="emit('chat')" @onboarding="emit('onboarding')" />
    </view>
    <button class="text-button with-icon" @click="emit('history')" hover-class="pressed" :hover-start-time="0" :hover-stay-time="70">回看走过的路 <SvgIcon name="arrow" :size="17" /></button>
  </view>
</template>

<style scoped>
.plan-empty-content > .home-heading, .plan-empty-content > .paper-card, .plan-empty-content > .text-button { position:relative; z-index:1; }
</style>

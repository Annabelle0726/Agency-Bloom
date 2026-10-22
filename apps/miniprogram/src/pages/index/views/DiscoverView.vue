<script setup lang="ts">
import { computed } from 'vue'
import SvgIcon from '../../../components/SvgIcon.vue'
import { discoveryPrompts } from '../data'
import { resolveDiscoverVisuals } from '../../../visual-library'
defineOptions({ options: { styleIsolation: 'apply-shared' } })
const props = defineProps<{ hasCurrent: boolean; themeId: string }>()
const art = computed(() => resolveDiscoverVisuals(props.themeId))
const cardSrc = (index: number) => art.value.cards[index]?.src || ''
const emit = defineEmits<{ explore: [question: string]; history: [] }>()
</script>

<template>
  <view class="workspace discover-content bloom-content">
    <view class="bloom-hero" aria-hidden="true">
      <image class="bloom-hero-image" :src="art.hero" mode="aspectFill" />
      <view class="bloom-hero-wash" />
    </view>
    <view class="section-intro bloom-intro">
      <text class="eyebrow">A DIFFERENT PERSPECTIVE</text>
      <text class="page-title">换个角度，看看生活</text>
      <text class="page-description">有些答案，会从一个新的问题开始</text>
    </view>
    <view class="discovery-list">
      <button v-for="(prompt, index) in discoveryPrompts" :key="prompt.title"
              class="discovery-card bloom-discovery-card" :class="{ 'without-photo': !cardSrc(index) }"
              :data-discovery="index" @click="emit('explore', prompt.question)"
              hover-class="pressed" :hover-start-time="0">
        <image v-if="cardSrc(index)" class="discovery-photo" :src="cardSrc(index)" mode="aspectFill" aria-hidden="true" />
        <view class="discovery-copy">
          <view class="discovery-heading">
            <SvgIcon :name="prompt.icon" :size="18" />
            <text>{{ prompt.label }}</text>
            <SvgIcon name="arrow" :size="17" />
          </view>
          <text class="discovery-title">{{ prompt.title }}</text>
          <text class="discovery-question">{{ prompt.question }}</text>
        </view>
      </button>
      <text class="discovery-context">{{ hasCurrent ? '选一个问题，带着它聊聊' : '选一个问题，先留下线索' }}</text>
    </view>
    <button class="history-entry bloom-history" @click="emit('history')" hover-class="pressed">
      <SvgIcon name="note" :size="21" />
      <text>回看走过的路</text>
      <SvgIcon name="chevron" :size="18" />
    </button>
  </view>
</template>

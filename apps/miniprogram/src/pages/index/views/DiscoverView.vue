<script setup lang="ts">
import { computed } from 'vue'
import SvgIcon from '../../../components/SvgIcon.vue'
import { resolveDiscoverVisuals } from '../../../visual-library'
import type { DiscoveryRecommendation } from '../../../discovery'
defineOptions({ options: { styleIsolation: 'apply-shared' } })
const props = defineProps<{ themeId: string; recommendations: DiscoveryRecommendation[]; loading: boolean; error: string; loaded: boolean }>()
const art = computed(() => resolveDiscoverVisuals(props.themeId))
const cardSrc = (index: number) => art.value.cards[index]?.src || ''
const labels = { continue: '延续探索', perspective: '换个角度', reality: '走向现实' }
const icons = { continue: 'compass', perspective: 'paths', reality: 'sun' }
function openJourney() { uni.navigateTo({ url: '/pages/journey/index?theme=' + props.themeId }) }
const emit = defineEmits<{ explore: [item: DiscoveryRecommendation]; dismiss: [item: DiscoveryRecommendation]; rotate: []; retry: [] }>()
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
      <text v-if="loading" class="discovery-context" role="status">正在看看你留下的线索</text>
      <view v-else-if="error" class="discovery-status"><text>{{ error }}</text><button class="text-button" @click="emit('retry')">重新读取</button></view>
      <template v-else-if="loaded">
        <view v-for="(prompt, index) in recommendations" :key="prompt.id" class="discovery-item">
          <button class="discovery-card bloom-discovery-card" :class="{ 'without-photo': !cardSrc(index) }"
                  :data-discovery="index" @click="emit('explore', prompt)" hover-class="pressed" :hover-start-time="0">
            <image v-if="cardSrc(index)" class="discovery-photo" :src="cardSrc(index)" mode="aspectFill" aria-hidden="true" />
            <view class="discovery-copy">
              <view class="discovery-heading"><SvgIcon :name="icons[prompt.intent]" :size="18" /><text>{{ labels[prompt.intent] }}</text><SvgIcon name="arrow" :size="17" /></view>
              <text class="discovery-title">{{ prompt.title }}</text>
              <text class="discovery-question">{{ prompt.question }}</text>
            </view>
          </button>
          <view class="discovery-meta"><text>{{ prompt.sourceLabel }}</text><button class="discovery-dismiss" @click="emit('dismiss', prompt)" hover-class="pressed" :hover-start-time="0">不太适用</button></view>
        </view>
        <text v-if="!recommendations.length" class="discovery-context">暂时没有更合适的问题\n不必急着开始，等有了新的线索再来</text>
        <view v-else class="discovery-tools"><text class="discovery-context">开启新对话，问题可以自由修改</text><button class="discovery-rotate" @click="emit('rotate')" hover-class="pressed" :hover-start-time="0">换一组</button></view>
      </template>
    </view>
    <button class="history-entry bloom-history" @click="openJourney" hover-class="pressed"><SvgIcon name="note" :size="21" /><text>回看走过的路</text><SvgIcon name="chevron" :size="18" /></button>
  </view>
</template>
<style lang="scss">
.discover-content {
  .discovery-item { min-width: 0; }
  .discovery-meta, .discovery-tools { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .discovery-meta { padding: 0 3px; color: var(--muted); font-size: 12px; }
  .discovery-dismiss, .discovery-rotate { flex-shrink: 0; min-height: 44px; margin: 0; padding: 0 4px; display: flex; align-items: center; font-size: 12px; color: var(--muted); background: transparent; border: 0; border-radius: 6px; line-height: 1.5; }
  .discovery-dismiss::after, .discovery-rotate::after { border: 0; }
  .discovery-tools .discovery-context { margin: 0; text-align: left; }
  .discovery-context, .discovery-status { white-space: pre-line; }
  .discovery-status { color: var(--muted); font-size: 14px; line-height: 1.7; }
}
</style>

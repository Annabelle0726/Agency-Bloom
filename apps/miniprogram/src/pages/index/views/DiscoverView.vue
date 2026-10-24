<script setup lang="ts">
import { computed } from 'vue'
import SvgIcon from '../../../components/SvgIcon.vue'
import { resolveDiscoverVisuals } from '../../../visual-library'
import { discoverAtmosphere } from '../../../discover-atmosphere'
import { discoverScrollPose } from '../../../discover-scroll'
import type { DiscoveryRecommendation } from '../../../discovery'
defineOptions({ options: { styleIsolation: 'apply-shared' } })
const props = withDefaults(defineProps<{ themeId: string; scrollTop?: number; recommendations: DiscoveryRecommendation[]; loading: boolean; error: string; loaded: boolean }>(), { scrollTop: 0 })
const petals = computed(() => discoverAtmosphere(props.themeId, 'petals'))
const leaves = computed(() => discoverAtmosphere(props.themeId, 'leaves'))
const botanicalStyles = computed(() => {
  const pose = discoverScrollPose(props.scrollTop)
  const style = (p: typeof pose.petals) => ({ transform: `translate3d(${p.x.toFixed(3)}px, ${p.y.toFixed(3)}px, 0) rotate(${p.rotation.toFixed(3)}deg)` })
  return { petals: style(pose.petals), leaves: style(pose.leaves) }
})
const art = computed(() => resolveDiscoverVisuals(props.themeId))
const cardSrc = (index: number) => art.value.cards[index]?.src || ''
const labels = { continue: '延续探索', perspective: '换个角度', reality: '走向现实' }
function openJourney() { uni.navigateTo({ url: '/pages/journey/index?theme=' + props.themeId }) }
const emit = defineEmits<{ explore: [item: DiscoveryRecommendation]; dismiss: [item: DiscoveryRecommendation]; rotate: []; retry: [] }>()
</script>

<template>
  <view class="workspace discover-content bloom-content">
    <view class="discover-atmosphere" aria-hidden="true">
      <view class="discover-botanical discover-petals" :style="botanicalStyles.petals">
        <image class="discover-botanical-art" :src="petals" mode="aspectFit" />
      </view>
      <view class="discover-botanical discover-leaves" :style="botanicalStyles.leaves">
        <image class="discover-botanical-art" :src="leaves" mode="aspectFit" />
      </view>
    </view>
    <view class="discover-foreground">
    <view class="discover-intro">
      <text class="discover-title">给今天，留一点好奇</text>
      <text class="discover-subtitle">不必带着问题来，也许会带走一点新鲜</text>
    </view>
    <view class="discover-moment"><slot name="moment" /></view>
    <view class="discover-section"><text>也可以，从这里聊起</text><view class="discover-rule" /></view>
    <view class="discovery-list">
      <text v-if="loading" class="discovery-context" role="status">正在看看你留下的线索</text>
      <view v-else-if="error" class="discovery-status"><text>{{ error }}</text><button class="text-button" @click="emit('retry')">重新读取</button></view>
      <template v-else-if="loaded">
        <view v-for="(prompt, index) in recommendations" :key="prompt.id" class="discovery-item">
          <button class="discovery-card bloom-discovery-card" :class="{ 'without-photo': !cardSrc(index) }"
                  :data-discovery="index" @click="emit('explore', prompt)" hover-class="pressed" :hover-start-time="0">
            <view class="discovery-top">
            <view class="discovery-copy">
              <view class="discovery-heading"><text>{{ labels[prompt.intent] }}</text></view>
              <text class="discovery-title">{{ prompt.title }}</text>
            </view>
            <image v-if="cardSrc(index)" class="discovery-photo" :src="cardSrc(index)" mode="aspectFill" aria-hidden="true" />
            </view>
            <view class="discovery-question-row"><text class="discovery-question">{{ prompt.question }}</text><SvgIcon name="arrow" :size="18" tone="accent" /></view>
          </button>
          <view class="discovery-meta"><text>{{ prompt.sourceLabel }}</text><button v-if="prompt.strategy !== 'self'" class="discovery-dismiss" @click="emit('dismiss', prompt)" hover-class="pressed" :hover-start-time="0">不太适用</button></view>
        </view>
        <text v-if="recommendations.some(item => item.strategy === 'self')" class="discovery-context discovery-invitation">如果这些问题还不贴近你，可以想想：此刻你需要什么？
不必马上说清楚，也可以从一件小事开始</text>
        <view class="discovery-tools"><text class="discovery-context">开启新对话，问题可以自由修改</text><button v-if="recommendations.some(item => item.strategy !== 'self')" class="discovery-rotate" @click="emit('rotate')" hover-class="pressed" :hover-start-time="0">换一组</button></view>
      </template>
    </view>
    <button class="history-entry bloom-history" @click="openJourney" hover-class="pressed"><SvgIcon name="note" :size="21" /><text>回看走过的路</text><SvgIcon name="chevron" :size="18" /></button>
    </view>
  </view>
</template>
<style scoped lang="scss">
/* Kept local to Discover: the Plan page still owns its atmospheric hero. */
.theme-space .discover-content { padding: 8px 22px 32px; }
.discover-content {
  .discover-atmosphere { position: fixed; z-index: 0; top: 0; bottom: 0; left: 0; right: 0; margin: auto; width: 100%; max-width: 440px; height: 100vh; background:var(--bg); overflow: hidden; pointer-events: none; }
  .discover-botanical { position: absolute; top: 0; right: 0; bottom: 0; left: 0; width: 100%; height: 100%; transition: transform 140ms cubic-bezier(.16, 1, .3, 1); will-change: transform; }
  .discover-petals { transform-origin: 100% 0; }
  .discover-leaves { transform-origin: 0 68%; }
  .discover-botanical-art { display: block; width: 100%; height: 100%; transform: scale(.76); animation: discover-petal-breathe 16s ease-in-out infinite; will-change: opacity; }
  .discover-petals .discover-botanical-art { transform-origin: 100% 0; }
  .discover-leaves .discover-botanical-art { transform-origin: 0 68%; animation-name: discover-leaf-breathe; animation-duration: 20s; animation-delay: -5s; }
  .discover-foreground { position: relative; z-index: 1; }
  .discover-intro { padding: 10px 0 24px; }
  .discover-title { display:block; font-family:var(--font-heading); color:var(--ink); font-size:var(--type-title); font-weight:500; line-height:1.5; }
  .discover-subtitle { display:block; margin-top:10px; font-family:var(--font-body); font-size:var(--type-subtitle); font-weight:400; line-height:1.75; color:var(--muted); }
  .discover-moment { margin-bottom: 30px; }
  .discover-section { display: flex; align-items: center; gap: 16px; margin-bottom: 4px; font-size: 14px; color: var(--muted); }
  .discover-rule { flex: 1; height: 1px; background: var(--line); }
  .discovery-item { min-width: 0; padding: 16px 0 10px; border-bottom: 1px solid var(--line); }
  .bloom-discovery-card { display: block; width: 100%; margin: 0; padding: 0; border: 0; border-radius: 8px; background: transparent; box-shadow: none; backdrop-filter: none; -webkit-backdrop-filter: none; text-align: left; }
  .bloom-discovery-card::after { border: 0; }
  .discovery-top { display: flex; align-items: center; gap: 18px; }
  .discovery-copy { flex: 1; min-width: 0; padding: 0; }
  .bloom-discovery-card .discovery-photo { flex: 0 0 60px; width: 60px; height: 70px; min-height: 0; align-self: center; border-radius: 6px; }
  .bloom-discovery-card .discovery-heading > text { font-size: 13px; color: var(--muted); }
  .bloom-discovery-card .discovery-title { font-family:var(--font-body); font-size:var(--type-card); font-weight:500; line-height:1.65; margin:6px 0 0; }
  .discovery-question-row { display: flex; align-items: center; gap: 16px; margin-top: 13px; }
  .bloom-discovery-card .discovery-question { flex: 1; font-size: 14px; line-height: 1.75; color: var(--ink); opacity: 1; }
  .discovery-meta, .discovery-tools { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .discovery-meta { padding: 4px 0 0; color: var(--muted); font-size: 13px; line-height: 1.6; }
  .discovery-dismiss, .discovery-rotate { flex-shrink: 0; min-height: 44px; margin: 0; padding: 0 4px; display: flex; align-items: center; font-size: 13px; color: var(--muted); background: transparent; border: 0; border-radius: 6px; line-height: 1.5; }
  .discovery-dismiss::after, .discovery-rotate::after { border: 0; }
  .discovery-tools { margin-top: 8px; }
  .discovery-tools .discovery-context { margin: 0; padding: 0; text-align: left; font-size: 13px; }
  .discovery-context, .discovery-status { white-space: pre-line; }
  .discovery-status { color: var(--muted); font-size: 14px; line-height: 1.7; }
  .bloom-history { margin-top: 12px; padding: 14px 0; }
  .bloom-history > text { font-size: 14px; }
}
/* Scroll moves the outer layer; opacity breathes without subpixel edge movement. */
@keyframes discover-petal-breathe {
  0%, 100% { opacity: .96; }
  50% { opacity: 1; }
}
@keyframes discover-leaf-breathe {
  0%, 100% { opacity: 1; }
  50% { opacity: .96; }
}
@media (prefers-reduced-motion: reduce) {
  .discover-content .discover-botanical { transform: none !important; transition: none; will-change: auto; }
  .discover-content .discover-botanical-art { animation: none; transform: scale(.76); opacity: 1; will-change: auto; }
}
@media (max-width: 360px) {
  .theme-space .discover-content { padding-left: 16px; padding-right: 16px; }
  .discover-content .discover-title { font-size:var(--type-title); }
}
</style>

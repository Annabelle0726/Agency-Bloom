<script setup lang="ts">
import { computed, toRef, watch } from 'vue'
import SvgIcon from '../../../components/SvgIcon.vue'
import DiscoverReading from './DiscoverReading.vue'
import { resolveDiscoverVisuals } from '../../../visual-library'
import { discoverAtmosphere } from '../../../discover-atmosphere'
import { discoverScrollPose } from '../../../discover-scroll'
import { discoveryTitle, discoveryDestination, type DiscoveryAngle } from '../../../discover-angles'
import type { Issue, Conversation } from '../../../domain'
defineOptions({ options: { styleIsolation: 'apply-shared' } })
const props = withDefaults(defineProps<{ themeId: string; scrollTop?: number; recommendations: DiscoveryAngle[]; loading: boolean; error: string; loaded: boolean; issues: Issue[]; focusId: string | null; conversations: Conversation[]; activeConversationId?: string; canRotate: boolean; emptyReason: string; ui: { expanded: string; source: string; momentOpen: boolean; picker: boolean } }>(), { scrollTop: 0 })
const petals = computed(() => discoverAtmosphere(props.themeId, 'petals'))
const leaves = computed(() => discoverAtmosphere(props.themeId, 'leaves'))
const art = computed(() => resolveDiscoverVisuals(props.themeId))
const cardSrc = (index: number) => art.value.cards[index]?.src || ['/static/visuals/reflection/reflection_sunlit_window_book_01.jpg', '/static/visuals/growth/growth_forest_path_violet_01.jpg', '/static/visuals/transition/transition_autumn_forest_path_01.jpg'][index % 3]
const botanicalStyles = computed(() => {
  const pose = discoverScrollPose(props.scrollTop)
  const style = (p: typeof pose.petals) => ({ transform: `translate3d(${p.x.toFixed(3)}px, ${p.y.toFixed(3)}px, 0) rotate(${p.rotation.toFixed(3)}deg)` })
  return { petals: style(pose.petals), leaves: style(pose.leaves) }
})
const picker = toRef(props.ui, 'picker'), expanded = toRef(props.ui, 'expanded'), source = toRef(props.ui, 'source')
const focus = computed(() => props.issues.find(i => i.id === props.focusId && !i.ended_at))
const choices = computed(() => props.issues.filter(i => !i.ended_at))
watch(() => props.recommendations.map(r => r.id).join('|'), () => {
  if (!props.recommendations.some(r => r.id === expanded.value)) expanded.value = props.recommendations[0]?.id || ''
  if (!props.recommendations.some(r => r.id === source.value)) source.value = ''
}, { immediate: true })
const destination = (item: DiscoveryAngle) => discoveryDestination(props.conversations, item.issueId, props.activeConversationId)
function choose(id: string | null) { picker.value = false; emit('focus', id) }
function openJourney() { uni.navigateTo({ url: '/pages/journey/index?theme=' + props.themeId + (props.focusId ? '&issue=' + encodeURIComponent(props.focusId) : '') }) }
const emit = defineEmits<{ explore: [item: DiscoveryAngle, separate?: boolean]; dismiss: [item: DiscoveryAngle]; rotate: []; retry: []; focus: [id: string | null]; chat: []; clue: [] }>()
</script>
<template>
  <view class="workspace discover-content bloom-content">
    <view class="discover-atmosphere" aria-hidden="true">
      <view class="discover-botanical discover-petals" :style="botanicalStyles.petals"><image class="discover-botanical-art" :src="petals" mode="aspectFit" /></view>
      <view class="discover-botanical discover-leaves" :style="botanicalStyles.leaves"><image class="discover-botanical-art" :src="leaves" mode="aspectFit" /></view>
    </view>
    <view class="discover-foreground">
      <view class="discover-focus">
        <view class="discover-focus-copy"><text class="discover-eyebrow">围绕这件事</text><text class="discover-focus-title">{{ focus ? discoveryTitle(focus) : '暂时不围绕某件事' }}</text></view>
        <button class="discover-link" :aria-expanded="picker" @click="picker = !picker" hover-class="pressed">切换</button>
      </view>
      <view v-if="picker" class="discover-picker">
        <button v-for="issue in choices" :key="issue.id" :aria-pressed="focusId === issue.id" class="discover-choice" @click="choose(issue.id)" hover-class="pressed"><text>{{ discoveryTitle(issue) }}</text><text v-if="focusId === issue.id">已选</text></button>
        <button class="discover-choice" @click="choose(null)" hover-class="pressed">暂时不围绕某件事</button>
      </view>
      <view class="discover-intro"><text class="discover-title">{{ focus ? '这件事，也许还有别的看法' : '留一点空间，看看新的可能' }}</text><text class="discover-subtitle">从你留下的线索出发，看看哪些值得多了解一点</text></view>
      <view v-if="loading" class="discover-status" role="status">正在读取你留下的线索</view>
      <view v-if="error" class="discover-status" role="alert"><text>{{ error }}</text><button class="discover-link" @click="emit('retry')">重新读取</button></view>
      <view class="discovery-list">
        <view v-for="(item, index) in recommendations" :key="item.id" class="discover-angle" :class="{ 'is-expanded': expanded === item.id }">
          <view class="discover-angle-heading" :data-discovery="index">
            <text class="discover-angle-title">{{ item.title }}</text><image v-if="cardSrc(index)" class="discover-angle-photo" :src="cardSrc(index)" mode="aspectFill" aria-hidden="true" />
          </view>
          <view class="discover-angle-rule" aria-hidden="true" />
          <text class="discover-evidence">你留下的线索：{{ item.evidence }}</text>
          <view class="discover-source-row">
            <button class="discover-source" :aria-expanded="source === item.id" :aria-controls="'source-' + index" @click="source = source === item.id ? '' : item.id" hover-class="discover-control-pressed" :hover-start-time="0"><text>{{ item.sourceLabel }} · {{ source === item.id ? '收起依据' : '查看依据' }}</text><view class="discover-fold-icon" :class="{ open: source === item.id }"><SvgIcon name="chevron" :size="14" tone="muted" /></view></button>
            <button class="discover-fold" :aria-label="(expanded === item.id ? '收起角度：' : '展开角度：') + item.title" :aria-expanded="expanded === item.id" :aria-controls="'angle-' + index" @click="expanded = expanded === item.id ? '' : item.id" hover-class="discover-control-pressed" :hover-start-time="0"><text>{{ expanded === item.id ? '收起' : '展开' }}</text><view class="discover-fold-icon" :class="{ open: expanded === item.id }"><SvgIcon name="chevron" :size="14" tone="muted" /></view></button>
          </view>
          <view v-if="source === item.id" :id="'source-' + index" class="discover-source-detail"><text>{{ item.evidence }}</text><text>{{ item.sourceDate?.slice(0, 10) || '日期未记录' }} · {{ focus ? discoveryTitle(focus) : '' }}</text><text>这是当时留下的记录，你现在的想法可以不同</text></view>
          <view v-if="expanded === item.id" :id="'angle-' + index" class="discover-angle-body">
            <text class="discover-perspective">{{ item.angle }}</text>
            <view class="discover-investigation"><text class="discover-eyebrow">可以先了解一点</text><text>{{ item.investigation }}</text></view>
            <button class="discover-explore" :disabled="loading" @click="emit('explore', item)" hover-class="pressed">聊聊这个角度 <SvgIcon name="arrow" :size="18" tone="accent" /></button>
            <text class="discover-destination">{{ destination(item) ? '继续「' + destination(item)!.title + '」中的对话' : '打开新对话草稿' }} · 可修改后发送</text>
            <view class="discover-card-actions"><button v-if="destination(item)" class="discover-link" :disabled="loading" @click="emit('explore', item, true)" hover-class="pressed">另开一段聊聊</button><button class="discover-link" :disabled="loading" @click="emit('dismiss', item)" hover-class="pressed">不太适用</button></view>
          </view>
        </view>
      </view>
      <view v-if="loaded && !loading && !error && !recommendations.length" class="discover-empty">
        <text class="discover-angle-title">{{ emptyReason === 'exhausted' ? '这些角度先放一放' : '先随意读一点' }}</text>
        <text>{{ emptyReason === 'exhausted' ? '也可以看看下面的图文，或聊聊自己的想法' : '还不用急着说清自己，先看看有没有让你好奇的内容' }}</text>
        <view class="discover-card-actions"><button class="discover-link" @click="emit('chat')">直接聊聊</button><button class="discover-link" @click="emit('clue')">补充一点</button></view>
      </view>
      <button v-if="canRotate" class="discover-link discover-rotate" :disabled="loading" @click="emit('rotate')" hover-class="pressed">看看其他角度</button>
      <DiscoverReading v-if="loaded && !loading && !error && !recommendations.length" :theme-id="themeId" />
      <view class="discover-inspiration">
        <view class="discover-moment-divider" aria-hidden="true">
          <view class="moment-divider-wing"><view /><view /><view /></view>
          <view class="moment-divider-jewel"><view class="moment-divider-petal petal-left" /><view class="moment-divider-petal petal-top" /><view class="moment-divider-petal petal-right" /><view class="moment-divider-heart" /></view>
          <view class="moment-divider-wing wing-right"><view /><view /><view /></view>
        </view>
        <view class="discover-moment"><slot name="moment" /></view>
      </view>
      <button class="history-entry bloom-history" @click="openJourney" hover-class="pressed"><SvgIcon name="note" :size="20" /><text>回看走过的路</text><SvgIcon name="chevron" :size="18" /></button>
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

<style scoped lang="scss">
.discover-focus { display:flex; align-items:center; gap:16px; padding:12px 0 4px; }
.discover-focus-copy { flex:1; min-width:0; }
.discover-eyebrow { display:block; color:var(--muted); font-size:12px; line-height:1.7; }
.discover-focus-title { display:block; color:var(--ink); font-size:14px; line-height:1.7; }
.discover-content .discover-intro { padding:16px 0 22px; }
.discover-content .discover-title { font-size:22px; }
.discover-content .discover-subtitle { margin-top:6px; font-size:13px; }
.discover-angle { margin-bottom:18px; padding:18px; border:1px solid var(--glass-border); border-radius:10px; background:linear-gradient(145deg,var(--glass-fill-a),var(--glass-fill-b)); box-shadow:var(--glass-inset),0 8px 24px #0000000a; backdrop-filter:blur(18px); -webkit-backdrop-filter:blur(18px); }
.discover-angle-heading { display:flex; align-items:center; gap:18px; min-width:0; }
.discover-angle-rule { height:1px; margin:16px 0 12px; background:var(--glass-line); }
.discover-angle-title { flex:1; display:block; font-family:var(--font-heading); font-size:18px; line-height:1.65; color:var(--ink); }
.discover-angle-photo { width:72px; height:88px; flex:0 0 72px; border-radius:8px; background:var(--soft); box-shadow:0 1px 3px #00000014; }
.discover-evidence { display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:2; overflow:hidden; font-size:13px; line-height:1.8; color:var(--muted); margin-top:6px; }
.discover-source,.discover-link { min-height:44px; display:flex; align-items:center; margin:0; padding:6px 0; background:transparent; color:var(--muted); font-size:13px; line-height:1.6; text-align:left; border:0; border-radius:6px; }
.discover-source-row { display:flex; align-items:center; gap:10px; margin:4px -4px 10px; }
.discover-source { flex:1; min-width:0; gap:6px; padding:6px 4px; font-size:12px; }
.discover-source > text { min-width:0; }
.discover-fold { display:flex; align-items:center; justify-content:center; gap:5px; min-height:44px; flex:0 0 auto; margin:0; padding:6px 4px 6px 8px; border:0; border-radius:6px; background:transparent; color:var(--muted); font-size:13px; line-height:1.6; }
.discover-fold-icon { display:flex; align-items:center; justify-content:center; flex-shrink:0; transform:rotate(90deg); transition:transform 180ms cubic-bezier(.23,1,.32,1); }
.discover-fold-icon.open { transform:rotate(-90deg); }
.discover-control-pressed { opacity:.65; }
.discover-angle-body { animation:discover-angle-reveal 180ms cubic-bezier(.23,1,.32,1); }
.discover-source-detail { animation:discover-angle-reveal 160ms cubic-bezier(.23,1,.32,1); }
.discover-source-detail { padding:12px; background:var(--glass-chip); border:1px solid var(--glass-line); border-radius:8px; margin-bottom:14px; }
.discover-source-detail text { display:block; font-size:12px; line-height:1.8; white-space:pre-wrap; color:var(--muted); }
.discover-perspective { display:block; font-size:15px; line-height:1.85; color:var(--ink); }
.discover-investigation { margin-top:18px; padding-left:12px; border-left:2px solid var(--line); font-size:14px; line-height:1.8; color:var(--ink); }
.discover-investigation .discover-eyebrow { margin-bottom:5px; }
.discover-explore { display:flex; align-items:center; gap:12px; width:100%; min-height:46px; margin:18px 0 4px; padding:8px 12px; background:var(--soft); color:var(--accent); font-size:14px; border:1px solid var(--line); border-radius:8px; }
.discover-destination { display:block; font-size:12px; line-height:1.7; color:var(--muted); }
.discover-card-actions { display:flex; flex-wrap:wrap; justify-content:space-between; gap:6px 20px; }
.discover-picker { padding:8px 12px; border:1px solid var(--line); background:var(--paper); border-radius:8px; }
.discover-choice { display:flex; justify-content:space-between; gap:16px; width:100%; min-height:48px; padding:8px 0; color:var(--ink); background:transparent; font-size:14px; line-height:1.7; text-align:left; }
.discover-choice[aria-pressed=true] { color:var(--accent); }
.discover-empty { padding:20px 0; color:var(--muted); font-size:14px; line-height:1.8; }
.discover-empty > text { display:block; margin-bottom:10px; }
.discover-status { padding:12px 0; color:var(--muted); font-size:13px; line-height:1.8; }
.discover-inspiration { margin-top:28px; }
.discover-moment-divider { display:flex; align-items:center; justify-content:center; gap:18px; height:36px; padding:0 10px; margin-bottom:22px; pointer-events:none; }
.moment-divider-wing { position:relative; flex:1; height:22px; }
.moment-divider-wing > view { position:absolute; right:0; height:1px; border-radius:1px; background:linear-gradient(90deg,transparent,var(--nav-gem-hi-soft)); transform-origin:right center; }
.moment-divider-wing > view:nth-child(1) { top:6px; width:76%; transform:rotate(3deg); opacity:.55; }
.moment-divider-wing > view:nth-child(2) { top:11px; width:100%; box-shadow:0 1px 5px var(--theme-glow); }
.moment-divider-wing > view:nth-child(3) { top:16px; width:62%; transform:rotate(-3deg); opacity:.4; }
.moment-divider-wing.wing-right { transform:scaleX(-1); }
.moment-divider-jewel { position:relative; width:34px; height:32px; flex:0 0 34px; }
.moment-divider-petal { position:absolute; width:10px; height:17px; border:1px solid var(--nav-gem-hi-soft); border-radius:10px 2px 10px 2px; background:linear-gradient(135deg,var(--glass-chip),transparent); box-shadow:inset 0 1px 0 var(--glass-chip-border); }
.moment-divider-petal.petal-left { left:4px; top:10px; transform:rotate(-58deg); }
.moment-divider-petal.petal-top { left:12px; top:2px; transform:rotate(-42deg); }
.moment-divider-petal.petal-right { right:4px; top:10px; transform:rotate(58deg) scaleX(-1); }
.moment-divider-heart { position:absolute; left:14px; bottom:2px; width:6px; height:6px; border-radius:50%; background:var(--nav-gem-hi); box-shadow:0 0 8px var(--nav-gem-glow),0 0 16px var(--theme-glow); }
.discover-inspiration-toggle > view { flex:1; }
.discover-inspiration .discover-angle-title { font-size:18px; }
.discover-inspiration .discover-moment { margin:16px 0 0; }
button::after { border:0; }
button[disabled] { opacity:.5; }
button { touch-action:manipulation; -webkit-tap-highlight-color:transparent; user-select:none; }
@keyframes discover-angle-reveal { from { opacity:.4; transform:translateY(-3px); } to { opacity:1; transform:translateY(0); } }
@media (max-width:360px) { .discover-angle { padding:15px; } .discover-angle-heading { gap:12px; } .discover-angle-photo { width:62px; height:78px; flex-basis:62px; } }
@media (prefers-reduced-motion:reduce) { .discover-fold-icon { transition:none; } .discover-angle-body,.discover-source-detail { animation:none; } }
</style>

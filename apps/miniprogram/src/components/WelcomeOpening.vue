<script setup lang="ts">
import { resolveAppMedia } from '../app-media'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import ActionButton from './ActionButton.vue'
import SvgIcon from './SvgIcon.vue'
const emit = defineEmits<{ start: [] }>()
const current = ref(0)
const reducedMotion = ref(false)
const revealed = ref<number[]>([])
const loaded = ref<number[]>([])
const slides = [
  {
    scene: 'mountain-person', label: '01 / 变化中的生活', accent: '#934d36',
    title: ['我想过的生活', '向前，想抵达哪里？'],
    lines: ['工作、学习和生活中的选择', '有时需要重新想一想', '有些现实暂时改变不了', '也可以先看清自己在意什么'],
    emphasis: '向前的意义，\n也许藏在你想过的一天里',
    note: '不必现在回答，可以从一件具体的事开始',
  },
  {
    scene: 'water', label: '02 / 一起看见可能', accent: '#246660',
    title: ['那些想要的', '也许还有更多选择'],
    lines: ['Bloom 陪你整理经历、比较取舍', '一起看看困惑里的不同角度', '也许眼前的几条路之外', '还有值得了解、甚至亲手创造的选择'],
    emphasis: '多一点选择，\n也多一点自己的余地',
    note: '新的角度是否适用，仍由你判断',
  },
  {
    scene: 'rest', label: '03 / 给休息一点余地', accent: '#85501f',
    title: ['还没有成为理想的自己', '也可以先好好生活'],
    lines: ['疲惫的时候，可以停一停', '喜欢的事，不必都变成收获', '今天只想说说，暂时不找办法', '也可以从这里开始'],
    emphasis: '休息，不需要先用成绩换取',
    note: '此刻的你，也值得被照顾',
  },
  {
    scene: 'path', label: '04 / 让体验带来新理解', accent: '#466238',
    title: ['现实会划出边界', '选择仍可以慢慢发生'],
    lines: ['先了解一种工作的日常', '试做一个小作品，或准备一次沟通', '看看实际发生了什么', '再决定继续、调整，还是放一放'],
    emphasis: '在尚有余地的地方，留一点自己的决定',
    note: '尝试的投入和边界，由你决定',
  },
  {
    scene: 'meadow', label: '05 / 从此刻开始', accent: '#5a602e',
    title: ['我还想', '按自己的意愿活一活'],
    lines: ['从此刻在意的一件事开始', '先听你说，也一起看见更多可能', '可以认真比较，也可以暂时停下', '你的选择，仍然可以改变'],
    emphasis: '愿每一次选择\n都更靠近你愿意亲自度过的生活',
    note: '不用先有答案，也可以开始',
  },
]
const slide = computed(() => slides[current.value])
let navigationAt = 0
let gestureMoved = false
let scrollingUntil = 0
let touchOrigin: { clientX: number; clientY: number } | undefined
function touchStart(event: { touches: { clientX: number; clientY: number }[] }) {
  touchOrigin = event.touches[0]
  gestureMoved = false
}
function touchMove(event: { touches: { clientX: number; clientY: number }[] }) {
  const point = event.touches[0]
  if (point && touchOrigin && Math.hypot(point.clientX - touchOrigin.clientX, point.clientY - touchOrigin.clientY) > 10) gestureMoved = true
}
function advance() {
  if (Date.now() < scrollingUntil) return
  if (gestureMoved) { gestureMoved = false; return }
  if (current.value < slides.length - 1) next()
}
function reveal(index: number) {
  if (!revealed.value.includes(index)) revealed.value = [...revealed.value, index]
}
function select(index: number) {
  if (index === current.value || Date.now() - navigationAt < 400) return
  navigationAt = Date.now()
  reveal(current.value)
  current.value = Math.max(0, Math.min(slides.length - 1, index))
}
function next() {
  if (current.value < slides.length - 1) select(current.value + 1)
  else if (Date.now() - navigationAt >= 400) { navigationAt = Date.now(); emit('start') }
}
function imageLoaded(index: number) {
  if (!loaded.value.includes(index)) loaded.value = [...loaded.value, index]
}
// #ifdef H5
let query: MediaQueryList | undefined
const motionChanged = () => { reducedMotion.value = !!query?.matches }
onMounted(() => {
  query = window.matchMedia('(prefers-reduced-motion: reduce)')
  motionChanged()
  query.addEventListener('change', motionChanged)
})
onUnmounted(() => query?.removeEventListener('change', motionChanged))
// #endif
</script>

<template>
  <view class="opening-story" :class="[{ 'motion-reduced': reducedMotion }, 'scene-' + current]" :style="{ '--story-accent': slides[current].accent }">
    <view class="story-backdrop" aria-hidden="true">
      <image v-for="(slide, index) in slides" :key="slide.scene"
        class="story-scene" :class="{ 'scene-active': current === index && loaded.includes(index) }"
        :src="resolveAppMedia('/static/opening-' + slide.scene + '.jpg')" mode="aspectFill" @load="imageLoaded(index)" />
      <view class="story-wash" />
    </view>
    <view class="story-header">
      <view class="story-brand"><text>AGENCY BLOOM</text><text class="story-brand-note">YOUR LIFE, YOUR WAY</text></view>
      <button class="story-skip" hover-class="pressed" @click="emit('start')">直接登录</button>
    </view>
    <view class="story-stage" @click="advance">
        <scroll-view :key="slide.scene" class="story-scroll" scroll-y :show-scrollbar="false"
          @touchstart="touchStart" @touchmove="touchMove" @scroll="scrollingUntil = Date.now() + 200">
          <view class="story-page"
            :class="{ playing: true, settled: revealed.includes(current) }"
            :style="{ '--story-accent': slide.accent }">
            <text class="story-label">{{ slide.label }}</text>
            <view class="story-title">
              <text v-for="(line, lineIndex) in slide.title" :key="line"
                class="story-title-line reveal-line" :class="{ 'story-emphasis': lineIndex === 1 }"
                :style="{ animationDelay: (lineIndex * 140) + 'ms' }">{{ line }}</text>
            </view>
            <view class="story-body">
              <text v-for="(line, lineIndex) in slide.lines" :key="line" class="story-body-line reveal-line"
                :style="{ animationDelay: (360 + lineIndex * 160) + 'ms' }">{{ line }}</text>
            </view>
            <text class="story-closing reveal-line" :style="{ animationDelay: (440 + slide.lines.length * 160) + 'ms' }">{{ slide.emphasis }}</text>
          </view>
        </scroll-view>
    </view>
    <view class="story-footer">
      <view class="story-pagination">
        <button v-for="(_, index) in slides" :key="index" class="story-dot-target"
          :aria-label="'第 ' + (index + 1) + ' 页，共 ' + slides.length + ' 页'"
          :aria-pressed="current === index" hover-class="pressed" @click="select(index)">
          <view class="story-dot" :class="{ active: current === index }" />
        </button>
        <text class="story-count">{{ current + 1 }} / {{ slides.length }}</text>
      </view>
      <text v-if="current === slides.length - 1" class="story-note">{{ slides[current].note }}</text>
      <ActionButton v-if="current === slides.length - 1" kind="opening" @click="next">进入 Bloom</ActionButton>
      <button v-else class="story-next" hover-class="pressed" :hover-start-time="0" @click="next"><text>继续阅读</text><SvgIcon name="arrow" light :size="17" /></button>
    </view>
  </view>
</template>

<style scoped>
.opening-story { position:relative; isolation:isolate; height:var(--app-height, 100vh); min-height:0; display:flex; flex-direction:column; box-sizing:border-box; overflow:hidden; color:#28332f; background:#f4f0e8; }
.story-backdrop { position:absolute; inset:0; pointer-events:none; z-index:0; }
.story-scene { position:absolute; width:100%; height:100%; left:0; top:0; opacity:0; transition:opacity 650ms ease; }
.story-scene.scene-active { opacity:1; }
.story-wash { position:absolute; inset:0; background:linear-gradient(180deg,rgba(250,248,241,.24),rgba(250,248,241,.68) 45%,rgba(250,248,241,.57) 62%,rgba(28,39,35,.12) 76%,rgba(22,33,28,.62)); }
.story-header, .story-stage, .story-footer { position:relative; z-index:1; }
.story-header { flex-shrink:0; display:flex; align-items:center; justify-content:space-between; gap:12px; padding:calc(var(--capsule-bottom, 64px) + 14px) 28px 4px; }
.story-brand { display:flex; flex-direction:column; gap:8px; font-size:14px; letter-spacing:3px; }
.story-brand-note { font-size:8px; letter-spacing:1.8px; color:#556057; }
.opening-story .story-skip { background:transparent; color:#465047; font-size:12px; line-height:1.6; min-height:44px; padding:12px 0 12px 12px; margin:0; }
.opening-story button::after { border:0; }
.story-stage { flex:1; height:0; min-height:0; width:100%; }
.story-scroll { height:100%; }
.story-page { min-height:100%; cursor:pointer; padding:32px 28px 28px; box-sizing:border-box; }
.story-label { display:block; font-size:10px; letter-spacing:1.8px; color:#566157; margin-bottom:20px; }
.story-title { font-family:var(--font-heading); font-size:26px; line-height:1.65; letter-spacing:0; font-weight:500; }
.story-title-line, .story-body-line { display:block; }
.story-body { font-size:14px; line-height:2.05; margin-top:24px; color:#3d4940; }
.story-emphasis { color:var(--story-accent); font-weight:600; }
.story-closing { display:block; margin-top:19px; font-size:14px; line-height:1.9; }
.playing .reveal-line { animation:story-line-in 600ms cubic-bezier(.2,.65,.3,1) both; }
.settled .reveal-line, .motion-reduced .reveal-line { animation:none; opacity:1; transform:none; }
@keyframes story-line-in { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
.story-footer { flex-shrink:0; padding:0 28px calc(9px + env(safe-area-inset-bottom)); }
.story-pagination { display:flex; align-items:center; }
.opening-story .story-dot-target { display:flex; align-items:center; justify-content:center; width:44px; min-width:44px; height:44px; padding:0; margin:0; background:transparent; }
.story-dot { width:5px; height:5px; border-radius:9px; background:rgba(255,255,255,.6); transition:width 280ms ease,background 280ms ease; }
.story-dot.active { width:20px; background:#fff; }
.story-count { margin-left:auto; font-size:10px; color:#fff; text-shadow:0 1px 6px #26382d; }
.story-note { display:block; color:#fff; text-shadow:0 1px 6px #26382d; font-size:11px; line-height:1.8; margin:0 0 14px; min-height:20px; }
.opening-story .story-about { min-height:44px; margin:3px auto 0; padding:12px; background:transparent; color:#fff; font-size:11px; line-height:1.8; text-shadow:0 1px 5px #253b2c; }
.motion-reduced .story-scene, .motion-reduced .story-dot { transition:none; }
@media(prefers-reduced-motion:reduce) {
  .playing .reveal-line { animation:none; }
  .story-scene, .story-dot { transition:none; }
}
@media(max-width:360px) {
  .story-header, .story-page, .story-footer { padding-left:24px; padding-right:24px; }
  .story-title { font-size:23px; }
  .story-body, .story-closing { font-size:13px; }
}
@media(max-height:720px) {
  .story-page { padding-top:18px; padding-bottom:20px; }
  .story-label { margin-bottom:12px; }
  .story-body { margin-top:17px; line-height:1.9; }
  .story-closing { margin-top:13px; }
}

/* Each scene is a composition: headline, breathing room, then a quiet aside. */
.story-wash { background:linear-gradient(180deg,rgba(250,248,241,.32),rgba(250,248,241,.34) 42%,rgba(250,248,241,.08) 62%,rgba(15,26,27,.50)); }
.story-page { display:flex; flex-direction:column; padding-top:30px; padding-bottom:22px; }
.story-title { font-family:'Kaiti SC','STKaiti','KaiTi',var(--font-heading); font-size:30px; font-weight:400; line-height:1.65; letter-spacing:1px; }
.story-emphasis { font-weight:400; }
.story-body { font-family:var(--font-heading); font-size:14px; line-height:2.15; margin-top:22px; }
.story-body-line:last-child { color:var(--story-accent); }
.story-closing { align-self:flex-end; max-width:86%; margin-top:auto; padding-top:40px; white-space:pre-line; text-align:right; font-family:'Kaiti SC','STKaiti','KaiTi',var(--font-heading); font-size:19px; font-weight:400; line-height:1.8; letter-spacing:1px; color:#fffaf1; text-shadow:0 2px 12px rgba(14,28,32,.6); }
.scene-0 .story-closing { max-width:100%; font-size:var(--type-section); }
.scene-1 .story-page { padding-top:48px; }
.scene-2 .story-title { font-size:27px; }
.scene-3 .story-body { margin-left:24px; }
.scene-4 .story-body { font-size:13px; line-height:1.95; margin-top:16px; }
.scene-4 .story-closing { padding-top:24px; font-size:17px; }
/* Lift the entire action/copy composition above the phone's bottom edge. */
.story-footer { padding-bottom:calc(52px + env(safe-area-inset-bottom, 0px)); }
@media(max-width:360px) {
  .story-title { font-size:26px; }
  .scene-2 .story-title { font-size:24px; }
  .story-body { font-size:13px; }
}
@media(max-height:720px) {
  .story-page,.scene-1 .story-page { padding-top:16px; padding-bottom:12px; }
  .story-body { margin-top:14px; line-height:1.9; }
  .story-closing { padding-top:24px; }
  .scene-4 .story-body { font-size:12px; line-height:1.85; }
  .story-footer { padding-bottom:calc(36px + env(safe-area-inset-bottom, 0px)); }
}
</style>

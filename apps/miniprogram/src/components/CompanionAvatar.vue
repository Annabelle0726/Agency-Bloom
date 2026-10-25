<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { createCompanionGaze, createNativeGazeFeed, type GazeFeed } from '../companion-gaze'
import type { BloomStatus } from '../bloom-status'

type CompanionMood = 'rest' | 'idle' | 'thinking' | 'speaking'
const props = withDefaults(defineProps<{
  size?: number
  state?: CompanionMood
  interactive?: boolean
  online?: boolean
  followGaze?: boolean
  foreground?: boolean
  status?: BloomStatus
}>(), { size: 38, state: 'idle', interactive: true, followGaze: false, foreground: true, online: undefined, status: undefined })

const touched = ref(false)
const imageReady = ref(false)
let resetTimer: ReturnType<typeof setTimeout> | undefined
const surface = ref<any>(null), gaze = ref({ x: 0, y: 0 }), reduced = ref(false), visible = ref(true)
const gazeEnabled = computed(() => imageReady.value && props.followGaze && props.foreground && !touched.value && !reduced.value && visible.value && (props.state === 'rest' || props.state === 'idle'))
const motion = computed(() => touched.value ? 'greeting' : gazeEnabled.value ? 'rest' : props.state)
let feed: GazeFeed = () => () => {}
// #ifdef MP-WEIXIN
feed = createNativeGazeFeed(uni)
// #endif
const gazeController = createCompanionGaze(feed, value => { gaze.value = value })
const eyeStyle = computed(() => ({ transform: `translate(${(gaze.value.x * props.size * .018).toFixed(2)}px, ${(gaze.value.y * props.size * .014).toFixed(2)}px)` }))
watch(gazeEnabled, value => gazeController.setActive(value), { flush: 'sync' })
let removeBrowserListeners = () => {}
let touch: { x: number; y: number } | null = null
function touchStart(event: { touches?: ArrayLike<{ clientX: number; clientY: number }> }) {
  const point = event.touches?.[0]
  if (point) touch = { x: point.clientX, y: point.clientY }
}
function touchMove(event: { touches?: ArrayLike<{ clientX: number; clientY: number }> }) {
  const point = event.touches?.[0]
  if (point && touch) gazeController.point((point.clientX - touch.x) / 28, (point.clientY - touch.y) / 28)
}
function releaseGaze() { touch = null; gazeController.release() }
function mouseMove(event: any) {
  // #ifdef H5
  const rect = (surface.value?.$el || surface.value)?.getBoundingClientRect?.()
  if (rect) gazeController.point((event.clientX - rect.left - rect.width / 2) / (rect.width / 2), (event.clientY - rect.top - rect.height / 2) / (rect.height / 2))
  // #endif
}
onMounted(() => {
  // #ifdef H5
  const media = window.matchMedia('(prefers-reduced-motion: reduce)')
  const motionChanged = () => { reduced.value = media.matches }
  const visibilityChanged = () => { visible.value = !document.hidden }
  motionChanged(); visibilityChanged()
  const element = (surface.value?.$el || surface.value) as HTMLElement | undefined
  element?.addEventListener('mousemove', mouseMove); element?.addEventListener('mouseleave', releaseGaze)
  media.addEventListener('change', motionChanged); document.addEventListener('visibilitychange', visibilityChanged)
  removeBrowserListeners = () => { element?.removeEventListener('mousemove', mouseMove); element?.removeEventListener('mouseleave', releaseGaze); media.removeEventListener('change', motionChanged); document.removeEventListener('visibilitychange', visibilityChanged) }
  // #endif
  gazeController.setActive(gazeEnabled.value)
})
const presence = computed<BloomStatus | null>(() => props.status || (props.online === false ? null : 'online'))
const presenceLabel = computed(() => presence.value === 'waiting'
  ? 'Bloom 正在回复'
  : presence.value === 'offline' ? 'Bloom 暂时不可用' : '在线')

function greet() {
  if (!props.interactive) return
  if (resetTimer) clearTimeout(resetTimer)
  touched.value = false
  Promise.resolve().then(() => { touched.value = true })
  resetTimer = setTimeout(() => { touched.value = false }, 600)
}

onUnmounted(() => {
  if (resetTimer) clearTimeout(resetTimer)
  removeBrowserListeners(); gazeController.dispose()
})
</script>

<template>
  <view ref="surface" class="companion-bot" :class="['bot-' + motion,{'bot-ready':imageReady}]"
        :style="{ width: size + 'px', height: size + 'px' }"
        :role="interactive ? 'button' : 'img'"
        :aria-label="interactive ? 'Bloom 机器人头像，轻触互动' : 'Bloom 机器人头像'"
        @tap="greet" @touchstart="touchStart" @touchmove="touchMove" @touchend="releaseGaze" @touchcancel="releaseGaze">
    <view v-if="!imageReady" class="bot-fallback" aria-hidden="true"><view class="fallback-sprout"/><view class="fallback-head"/><view class="fallback-body"/></view>
    <view v-if="imageReady" class="bot-glow" />
    <image class="bot-image" src="/static/companion-bot.png" mode="aspectFit" @load="imageReady=true" @error="imageReady=false" />
    <view class="bot-spark" />
    <view v-if="gazeEnabled" class="gaze-layer" aria-hidden="true">
      <view class="gaze-socket gaze-left"><view class="gaze-pupil" :style="eyeStyle"><view class="gaze-glint" /></view></view>
      <view class="gaze-socket gaze-right"><view class="gaze-pupil" :style="eyeStyle"><view class="gaze-glint" /></view></view>
    </view>
    <view v-if="presence" class="bot-online" :class="'is-' + presence" :aria-label="presenceLabel" />
  </view>
</template>

<style lang="scss" scoped>
.companion-bot {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  vertical-align: middle;
  border-radius: 50%;
  overflow: visible;
}
/* Live pupils align with the original 128px artwork; no new raster asset. */
.gaze-layer { position: absolute; inset: 0; z-index: 2; pointer-events: none; }
.gaze-socket { position: absolute; width: 9.4%; height: 13.3%; border-radius: 50%; background: #fcfbf5; }
.gaze-left { left: 33.6%; top: 48%; }
.gaze-right { left: 55.5%; top: 49.4%; }
.gaze-pupil { position: absolute; left: 21%; top: 19%; width: 58%; height: 62%; border-radius: 50%; background: linear-gradient(150deg, #7f9576, #486752); transition: transform 130ms cubic-bezier(.22, 1, .36, 1); }
.gaze-glint { position: absolute; left: 50%; top: 13%; width: 27%; height: 29%; border-radius: 50%; background: #fcfbf5; }
.bot-image {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  position: relative;
  z-index: 1;
  opacity:0;
  animation: bot-float 4.2s ease-in-out infinite;
}
.bot-ready .bot-image { opacity:1; }
/* Draw immediately; image decoding must not leave white sockets on an empty face. */
.bot-fallback { position:absolute; inset:0; pointer-events:none; }
.fallback-head { position:absolute; left:19%; top:31%; width:62%; height:48%; border:1px solid var(--accent,#58725f); border-radius:44%; background:var(--soft,#edf2eb); }
.fallback-head::before,.fallback-head::after { content:''; position:absolute; top:37%; width:10%; height:23%; border-radius:50%; background:var(--accent,#58725f); }
.fallback-head::before { left:22%; } .fallback-head::after { right:22%; }
.fallback-sprout { position:absolute; left:47%; top:12%; width:17%; height:23%; border-radius:100% 0 100% 0; background:var(--accent,#58725f); transform:rotate(15deg); }
.fallback-body { position:absolute; left:29%; top:79%; width:42%; height:12%; border:1px solid var(--accent,#58725f); border-radius:50% 50% 30% 30%; }
.bot-glow {
  position: absolute;
  inset: 5%;
  border-radius: 50%;
  background: rgba(157, 187, 159, .14);
  box-shadow: 0 0 13px rgba(143, 177, 151, .10);
  animation: bot-breathe 4.2s ease-in-out infinite;
}
.bot-spark {
  position: absolute;
  z-index: 2;
  top: 9%;
  right: -2%;
  width: 9%;
  height: 9%;
  border-radius: 50%;
  background: #b0c9b0;
  opacity: 0;
}
.bot-online {
  position: absolute;
  z-index: 3;
  right: -1px;
  bottom: -1px;
  width: 24%;
  height: 24%;
  min-width: 8px;
  min-height: 8px;
  max-width: 10px;
  max-height: 10px;
  border-radius: 50%;
  background: #58a06c;
  background: var(--bloom-online, #58a06c);
  border: 1.5px solid var(--paper, #ffffff);
  box-shadow: 0 0 4px rgba(88, 160, 108, .45);
  animation: bot-online-breathe 3.4s ease-in-out infinite;
}
.bot-online.is-waiting {
  background: #d8a33e;
  background: var(--bloom-waiting, #d8a33e);
  box-shadow: 0 0 4px rgba(216, 163, 62, .5);
  animation: bot-waiting-breathe 1.4s ease-in-out infinite;
}
.bot-online.is-offline {
  background: #cf5f5b;
  background: var(--bloom-offline, #cf5f5b);
  box-shadow: 0 0 4px rgba(207, 95, 91, .5);
  animation: none;
}
@keyframes bot-online-breathe {
  0%, 100% { box-shadow: 0 0 3px rgba(88, 160, 108, .35); }
  50% { box-shadow: 0 0 6px rgba(88, 160, 108, .6); }
}
@keyframes bot-waiting-breathe {
  0%, 100% { box-shadow: 0 0 3px rgba(216, 163, 62, .35); }
  50% { box-shadow: 0 0 7px rgba(216, 163, 62, .7); }
}
.bot-rest .bot-image, .bot-rest .bot-glow { animation: none; }
.bot-thinking .bot-image { animation: bot-think 1.9s ease-in-out infinite; }
.bot-thinking .bot-glow { animation: bot-focus 1.9s ease-in-out infinite; }
.bot-thinking .bot-spark { animation: bot-twinkle 1.9s ease-in-out infinite; }
.bot-speaking .bot-image { animation: bot-answer 740ms ease-out both; }
.bot-speaking .bot-glow { animation: bot-flash 740ms ease-out both; }
.bot-greeting .bot-image { animation: bot-hello 590ms ease-out both; }
.bot-greeting .bot-glow { animation: bot-flash 590ms ease-out both; }
.bot-greeting .bot-spark { animation: bot-twinkle 550ms ease-out both; }
@keyframes bot-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-1.4px); }
}
@keyframes bot-breathe {
  0%, 100% { opacity: .55; transform: scale(.97); }
  50% { opacity: .9; transform: scale(1.04); }
}
@keyframes bot-think {
  0%, 100% { transform: translateY(0) rotate(-1deg); }
  50% { transform: translateY(-2px) rotate(1deg); }
}
@keyframes bot-focus {
  0%, 100% { opacity: .6; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.12); }
}
@keyframes bot-answer {
  0% { transform: scale(.95); }
  44% { transform: scale(1.045) translateY(-1px); }
  100% { transform: scale(1); }
}
@keyframes bot-flash {
  0% { opacity: .6; transform: scale(.92); }
  45% { opacity: 1; transform: scale(1.13); }
  100% { opacity: .55; transform: scale(1); }
}
@keyframes bot-hello {
  0%, 100% { transform: rotate(0) scale(1); }
  32% { transform: rotate(-5deg) scale(1.045); }
  66% { transform: rotate(4deg); }
}
@keyframes bot-twinkle {
  0%, 100% { opacity: 0; transform: scale(.4); }
  45% { opacity: .75; transform: scale(1); }
}
@media (prefers-reduced-motion: reduce) {
  .gaze-layer { display: none; } .gaze-pupil { transition: none; }
  .bot-image, .bot-glow, .bot-spark { animation: none !important; }
  .bot-online { animation: none !important; }
}
</style>

<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'

type CompanionMood = 'rest' | 'idle' | 'thinking' | 'speaking'
const props = withDefaults(defineProps<{
  size?: number
  state?: CompanionMood
  interactive?: boolean
}>(), { size: 38, state: 'idle', interactive: true })

const reacting = ref(false)
let tapTimer: ReturnType<typeof setTimeout> | undefined
const mood = computed(() => reacting.value ? 'tap' : props.state)

function react() {
  if (!props.interactive) return
  if (tapTimer) clearTimeout(tapTimer)
  reacting.value = false
  // Force the next tap to restart the small animation without a network call.
  Promise.resolve().then(() => { reacting.value = true })
  tapTimer = setTimeout(() => { reacting.value = false }, 650)
}
onUnmounted(() => { if (tapTimer) clearTimeout(tapTimer) })
</script>

<template>
  <view
    class="companion"
    :class="'companion-' + mood"
    :style="{ width: size + 'px', height: size + 'px' }"
    :aria-label="interactive ? 'Agency OS 小火种，轻触互动' : 'Agency OS 小火种'"
    :role="interactive ? 'button' : 'img'"
    @tap="react"
  >
    <view class="ember-aura" />
    <view class="ember-float">
      <image src="/static/companion-ember.png" class="ember-art" mode="aspectFit" />
      <view class="ember-eye eye-left"/>
      <view class="ember-eye eye-right"/>
      <view class="ember-mouth"/>
    </view>
    <view class="ember-spark spark-a"/>
    <view class="ember-spark spark-b"/>
  </view>
</template>

<style lang="scss" scoped>
.companion {
  position: relative;
  display: inline-block;
  flex-shrink: 0;
  vertical-align: middle;
  overflow: visible;
  transform: translateZ(0);
}
.ember-aura {
  position: absolute;
  left: 19%;
  top: 29%;
  width: 66%;
  height: 61%;
  border-radius: 50%;
  background: rgba(242, 172, 112, .16);
  box-shadow: 0 0 11px rgba(238, 160, 110, .13);
  animation: ember-breathe 4s ease-in-out infinite;
}
.ember-float {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  animation: ember-float 4.2s ease-in-out infinite;
  transform-origin: 50% 72%;
}
.ember-art {
  display: block;
  width: 100%;
  height: 100%;
}
.ember-eye {
  position: absolute;
  top: 55%;
  width: 5.5%;
  height: 7%;
  border-radius: 60%;
  background: #574b49;
  transform-origin: 50% 50%;
  animation: ember-blink 6.8s ease-in-out infinite;
}
.eye-left { left: 36.8%; }
.eye-right { left: 57.1%; animation-delay: 30ms; }
.ember-mouth {
  position: absolute;
  left: 47.3%;
  top: 69%;
  width: 9.5%;
  height: 3.7%;
  border-bottom: 1.4px solid #a67569;
  border-radius: 0 0 90% 90%;
  opacity: .85;
}
.ember-spark {
  position: absolute;
  width: 4%;
  height: 4%;
  border-radius: 50%;
  background: #e5b28d;
  opacity: 0;
  pointer-events: none;
}
.spark-a { top: 18%; right: 9%; }
.spark-b { top: 42%; left: 8%; width: 3%; height: 3%; }
.companion-rest .ember-float,
.companion-rest .ember-aura,
.companion-rest .ember-eye { animation: none; }
.companion-thinking .ember-aura {
  animation: ember-thinking-glow 1.65s ease-in-out infinite;
  background: rgba(245, 178, 114, .22);
}
.companion-thinking .ember-float { animation: ember-think 1.8s ease-in-out infinite; }
.companion-thinking .ember-spark { animation: ember-twinkle 1.65s ease-in-out infinite; }
.companion-thinking .spark-b { animation-delay: .65s; }
.companion-speaking .ember-float { animation: ember-speak 730ms ease-out both; }
.companion-speaking .ember-aura { animation: ember-speak-light 730ms ease-out both; }
.companion-tap .ember-float { animation: ember-hello 620ms cubic-bezier(.2,.7,.2,1) both; }
.companion-tap .ember-aura { animation: ember-speak-light 620ms ease-out both; }
.companion-tap .eye-left { animation: ember-wink 620ms ease-in-out both; }
.companion-tap .ember-spark { animation: ember-twinkle 550ms ease-out both; }
.companion-tap .spark-b { animation-delay: 90ms; }
@keyframes ember-breathe {
  0%, 100% { transform: scale(.95); opacity: .62; }
  50% { transform: scale(1.08); opacity: 1; }
}
@keyframes ember-float {
  0%, 100% { transform: translateY(0) rotate(-1deg); }
  50% { transform: translateY(-2px) rotate(1deg); }
}
@keyframes ember-blink {
  0%, 43%, 47%, 100% { transform: scaleY(1); }
  45% { transform: scaleY(.12); }
}
@keyframes ember-wink {
  0%, 30%, 60%, 100% { transform: scaleY(1); }
  43% { transform: scaleY(.12); }
}
@keyframes ember-thinking-glow {
  0%, 100% { opacity: .68; transform: scale(.97); }
  50% { opacity: 1; transform: scale(1.15); }
}
@keyframes ember-think {
  0%, 100% { transform: translateY(0) rotate(-2deg); }
  50% { transform: translateY(-3px) rotate(3deg); }
}
@keyframes ember-speak {
  0% { transform: scale(.93) translateY(2px); }
  43% { transform: scale(1.09) translateY(-2px); }
  100% { transform: scale(1) translateY(0); }
}
@keyframes ember-speak-light {
  0% { opacity: .5; transform: scale(.87); }
  45% { opacity: 1; transform: scale(1.22); }
  100% { opacity: .6; transform: scale(1); }
}
@keyframes ember-hello {
  0% { transform: scale(1) rotate(0); }
  30% { transform: scale(1.14) rotate(-8deg) translateY(-2px); }
  65% { transform: scale(1.04) rotate(6deg); }
  100% { transform: scale(1) rotate(0); }
}
@keyframes ember-twinkle {
  0%, 100% { opacity: 0; transform: scale(.2) translateY(3px); }
  45% { opacity: .9; transform: scale(1) translateY(-2px); }
}
@media (prefers-reduced-motion: reduce) {
  .ember-aura, .ember-float, .ember-eye, .ember-spark { animation: none !important; }
}
</style>

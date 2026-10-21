<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'

type CompanionMood = 'rest' | 'idle' | 'thinking' | 'speaking'
const props = withDefaults(defineProps<{
  size?: number
  state?: CompanionMood
  interactive?: boolean
  online?: boolean
}>(), { size: 38, state: 'idle', interactive: true, online: false })

const touched = ref(false)
let resetTimer: ReturnType<typeof setTimeout> | undefined
const motion = computed(() => touched.value ? 'greeting' : props.state)

function greet() {
  if (!props.interactive) return
  if (resetTimer) clearTimeout(resetTimer)
  touched.value = false
  Promise.resolve().then(() => { touched.value = true })
  resetTimer = setTimeout(() => { touched.value = false }, 600)
}

onUnmounted(() => {
  if (resetTimer) clearTimeout(resetTimer)
})
</script>

<template>
  <view class="companion-bot" :class="'bot-' + motion"
        :style="{ width: size + 'px', height: size + 'px' }"
        :role="interactive ? 'button' : 'img'"
        :aria-label="interactive ? 'Bloom 机器人头像，轻触互动' : 'Bloom 机器人头像'"
        @tap="greet">
    <view class="bot-glow" />
    <image class="bot-image" src="/static/companion-bot.png" mode="aspectFit" />
    <view class="bot-spark" />
    <view v-if="online" class="bot-online" aria-label="在线" />
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
.bot-image {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  position: relative;
  z-index: 1;
  animation: bot-float 4.2s ease-in-out infinite;
}
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
  border: 1.5px solid var(--paper, #ffffff);
  box-shadow: 0 0 4px rgba(88, 160, 108, .45);
  animation: bot-online-breathe 3.4s ease-in-out infinite;
}
@keyframes bot-online-breathe {
  0%, 100% { box-shadow: 0 0 3px rgba(88, 160, 108, .35); }
  50% { box-shadow: 0 0 6px rgba(88, 160, 108, .6); }
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
  .bot-image, .bot-glow, .bot-spark { animation: none !important; }
  .bot-online { animation: none !important; }
}
</style>

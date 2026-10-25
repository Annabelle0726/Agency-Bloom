<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue'
import AuthWelcome, { type AuthWelcomeProps } from './AuthWelcome.vue'
import WelcomeOpening from './WelcomeOpening.vue'

const props = defineProps<{ opening: boolean; auth: AuthWelcomeProps }>()
const emit = defineEmits<{ start: []; login: [mode: 'wechat' | 'demo-new' | 'demo-resume']; replay: []; privacy: []; retry: [] }>()
const coverVisible = ref(props.opening)
const fading = ref(false)
const backgroundReady = ref(false)
let requested = false
let timer: ReturnType<typeof setTimeout> | undefined
let backgroundTimer: ReturnType<typeof setTimeout> | undefined

function revealAuth() {
  if (props.opening || !backgroundReady.value || !coverVisible.value || fading.value) return
  fading.value = true
  timer = setTimeout(() => { coverVisible.value = false }, 220)
}
function loaded() { backgroundReady.value = true; revealAuth() }
function start() {
  if (requested) return
  requested = true
  emit('start')
}
watch(() => props.opening, opening => {
  clearTimeout(timer)
  clearTimeout(backgroundTimer)
  if (opening) { coverVisible.value = true; fading.value = false; requested = false }
  else {
    revealAuth()
    // The destination already has a solid background; never block login on artwork.
    backgroundTimer = setTimeout(() => { backgroundReady.value = true; revealAuth() }, 1200)
  }
})
onUnmounted(() => { clearTimeout(timer); clearTimeout(backgroundTimer) })
</script>

<template>
  <view class="entry-welcome">
    <!-- Mount the destination before leaving the opening. The cover stays
         painted until the destination image settles, with a bounded fallback. -->
    <view class="entry-auth" :class="{ 'entry-auth-covered': coverVisible && !fading }" :aria-hidden="coverVisible && !fading">
      <AuthWelcome v-bind="auth" @background-ready="loaded" @login="emit('login', $event)"
        @replay="emit('replay')" @privacy="emit('privacy')" @retry="emit('retry')" />
    </view>
    <view v-if="coverVisible" class="entry-opening" :class="{ 'entry-opening-leaving': fading }" :aria-hidden="fading">
      <WelcomeOpening @start="start" />
    </view>
  </view>
</template>

<style scoped>
.entry-welcome { position:relative; background:var(--bg); }
.entry-auth-covered { visibility:hidden; pointer-events:none; }
.entry-opening { position:absolute; inset:0; z-index:2; opacity:1; transition:opacity 220ms var(--ease-out); }
.entry-opening-leaving { opacity:0; pointer-events:none; }
@media(prefers-reduced-motion:reduce) { .entry-opening { transition:none; } }
</style>

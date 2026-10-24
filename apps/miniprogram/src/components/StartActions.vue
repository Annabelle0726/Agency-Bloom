<script setup lang="ts">
import SvgIcon from './SvgIcon.vue'
defineProps<{ disabled?: boolean }>()
defineEmits<{ chat: []; onboarding: [] }>()
</script>

<template>
  <view class="start-actions">
    <button class="start-action start-chat" :disabled="disabled" hover-class="start-pressed" :hover-start-time="0" :hover-stay-time="70" @click="!disabled && $emit('chat')">
      <text>直接聊聊</text><SvgIcon name="arrow" :size="18" light />
    </button>
    <button class="start-action start-questions" :disabled="disabled" hover-class="start-pressed" :hover-start-time="0" :hover-stay-time="70" @click="!disabled && $emit('onboarding')">
      <text>用几个问题整理起点</text>
    </button>
  </view>
</template>

<style scoped>
.start-actions { display:flex; flex-direction:column; gap:10px; width:100%; }
.start-action { display:flex; align-items:center; justify-content:center; gap:10px; box-sizing:border-box; width:100%; min-height:50px; margin:0; padding:12px 16px; border-radius:10px; font-family:var(--font-body); font-size:var(--type-button); font-weight:500; line-height:1.5; text-shadow:none; box-shadow:none; touch-action:manipulation; transition:background-color 130ms var(--ease-out),border-color 130ms var(--ease-out); }
.start-action::after { border:0; }
.start-chat { background:var(--cta-fill); color:var(--cta-ink); border:1px solid var(--cta-border); }
.start-questions { background:var(--soft); color:var(--ink); border:1px solid var(--line); }
.start-chat.start-pressed,.start-chat:active:not([disabled]) { background:var(--cta-deep); }
.start-questions.start-pressed,.start-questions:active:not([disabled]) { background:var(--selection); border-color:var(--selection-border); }
.start-action[disabled] { background:var(--control-disabled-bg); color:var(--control-disabled-ink); border-color:var(--line); }
.start-action:focus-visible { outline:2px solid var(--selection-border); outline-offset:3px; }
@media(prefers-reduced-motion:reduce) { .start-action { transition:none; } }
</style>

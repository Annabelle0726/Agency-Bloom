<script setup lang="ts">
import { computed, inject } from 'vue'
import SvgIcon from '../../../components/SvgIcon.vue'
import { SPEECH_KEY, speechKey } from '../../../speech'
import type { ChatMessage } from '../../../domain'
defineOptions({ options: { styleIsolation: 'apply-shared' } })
const props=defineProps<{message:ChatMessage}>()
const speech=inject(SPEECH_KEY)
const active=computed(()=>!!speech && speech.activeKey.value===speechKey(props.message))
const stage=computed(()=>active.value?speech?.stage.value:'idle')
const label=computed(()=>stage.value==='playing'?'暂停':stage.value==='paused'?'继续':stage.value==='loading'?'准备音频':'朗读')
</script>
<template>
  <view v-if="speech && speechKey(message)" class="read-aloud" :class="{'read-aloud-active':active}">
    <button class="speech-toggle" :aria-label="label + '这条回复'" :disabled="stage==='loading'" @click.stop="speech.toggle(message)" hover-class="pressed">
      <SvgIcon :name="stage==='playing'?'pause':'volume'" tone="muted" :size="15"/>
      <text>{{ label }}</text>
    </button>
    <template v-if="active && stage!=='idle'">
      <button class="speech-rate" aria-label="切换朗读语速" @click.stop="speech.cycleRate()" hover-class="pressed">{{ speech.rate.value }}×</button>
      <button class="speech-stop" aria-label="停止朗读" @click.stop="speech.stop()" hover-class="pressed"><SvgIcon name="stop" tone="muted" :size="13"/></button>
      <text v-if="speech.mode.value==='mock'" class="speech-demo">Mock 试听音</text>
    </template>
  </view>
</template>
<style scoped>
.read-aloud{display:flex;align-items:center;gap:4px;min-height:32px;color:var(--muted);font-size:11px;flex-wrap:wrap}
.read-aloud button{margin:0;padding:6px 5px;background:transparent;line-height:20px;font-size:11px;color:var(--muted);border:0;border-radius:8px;transition:opacity 120ms ease,background 160ms ease}
.read-aloud button::after{border:0}.speech-toggle{display:flex;align-items:center;gap:5px;min-height:32px}.speech-stop{display:flex;align-items:center;justify-content:center;min-width:28px;min-height:32px}
.speech-rate{min-width:38px;font-variant-numeric:tabular-nums}.speech-demo{font-size:10px;opacity:.8}.read-aloud-active .speech-toggle{color:var(--text)}
</style>

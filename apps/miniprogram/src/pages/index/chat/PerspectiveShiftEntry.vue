<script setup lang="ts">
import { ref, watch } from 'vue'
import SvgIcon from '../../../components/SvgIcon.vue'
import type { PerspectiveShift } from '../../../domain'
import type { PerspectiveAction } from '../../../perspective-shift'

defineOptions({ options: { styleIsolation: 'apply-shared' } })
const props = defineProps<{ candidate: PerspectiveShift; busy?: boolean }>()
const emit = defineEmits<{ act: [action: PerspectiveAction] }>()
const open = ref(false)
watch(() => props.candidate, () => { open.value = false })
</script>

<template>
  <view class="perspective-entry">
    <button class="perspective-toggle" :aria-expanded="open" aria-label="换个角度，一个可能遗漏的前提"
      hover-class="perspective-pressed" :hover-start-time="0" :hover-stay-time="70" @click="open = !open">
      <SvgIcon name="compass" :size="15" tone="muted" />
      <text>换个角度 · 一个可能遗漏的前提</text>
      <SvgIcon name="chevron" :size="11" tone="muted" />
    </button>
    <view v-if="open" class="perspective-detail">
      <text class="perspective-label">可能遗漏了</text>
      <text class="perspective-text">{{ candidate.possible_blind_spot }}</text>
      <text class="perspective-label">为什么值得留意</text>
      <text class="perspective-text">{{ candidate.observation }}</text>
      <text class="perspective-label">也可以这样看</text>
      <text class="perspective-text">{{ candidate.alternative_perspective }}</text>
      <text class="perspective-uncertainty">{{ candidate.uncertainty }}</text>
      <text v-if="candidate.optional_next_question" class="perspective-text">{{ candidate.optional_next_question }}</text>
      <view class="perspective-actions">
        <button :disabled="busy" hover-class="perspective-pressed" @click="emit('act', 'follow')">沿这个角度聊聊</button>
        <button :disabled="busy" hover-class="perspective-pressed" @click="emit('act', 'dismiss')">不太适用</button>
        <button :disabled="busy" hover-class="perspective-pressed" @click="emit('act', 'disable')">暂时关闭</button>
      </view>
    </view>
  </view>
</template>

<style scoped>
.perspective-entry { margin-top: 8px; max-width: 100%; color: var(--ink); }
.perspective-toggle { display: flex; align-items: center; justify-content: flex-start; gap: 7px; padding: 4px 0; margin: 0; min-height: 44px; background: transparent; color: var(--muted); font-size: 12px; line-height: 1.5; text-align: left; border-radius: 6px; }
.perspective-toggle::after, .perspective-actions button::after { border: 0; }
.perspective-toggle text { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.perspective-detail { border-left: 1px solid var(--line); padding: 2px 0 0 12px; }
.perspective-label { display: block; color: var(--muted); font-size: 11px; margin: 12px 0 5px; }
.perspective-text { display: block; font-size: 13px; line-height: 1.75; overflow-wrap: anywhere; white-space: pre-wrap; }
.perspective-uncertainty { display: block; margin-top: 10px; color: var(--muted); font-size: 12px; line-height: 1.65; }
.perspective-actions { display: flex; flex-wrap: wrap; gap: 0 12px; margin-top: 8px; }
.perspective-actions button { padding: 0; margin: 0; min-height: 44px; background: transparent; color: var(--accent); font-size: 12px; line-height: 44px; border-radius: 6px; }
.perspective-actions button[disabled] { opacity: .5; }
.perspective-pressed { opacity: .65; }
</style>

<script setup lang="ts">
import SvgIcon from './SvgIcon.vue'
withDefaults(defineProps<{ title: string; detail?: string; icon?: string; selected?: boolean; radio?: boolean }>(), { selected: false })
defineEmits<{ select: [] }>()
</script>
<template>
  <button class="selection-card" :class="{ chosen: selected, detailed: detail }" :aria-pressed="selected" hover-class="selection-pressed" :hover-start-time="0" :hover-stay-time="70" @click="$emit('select')">
    <view v-if="radio" class="selection-radio" :class="{ checked: selected }"><view /></view>
    <SvgIcon v-else-if="icon" class="selection-icon" :name="icon" :size="21" />
    <view class="selection-copy"><text class="selection-title">{{ title }}</text><text v-if="detail" class="selection-detail">{{ detail }}</text></view>
    <view v-if="!radio" class="selection-check" :class="{ visible: selected }"><SvgIcon name="check" :size="16" /></view>
  </button>
</template>
<style scoped>
.selection-card { display:flex; align-items:center; gap:13px; width:100%; min-height:57px; margin:0; padding:15px 16px; background:var(--paper); border:1px solid var(--line); border-radius:8px; color:var(--ink); text-align:left; box-sizing:border-box; transition:background var(--motion-press),border-color var(--motion-press),transform var(--motion-press); touch-action:manipulation; }
.selection-card::after { border:0; }
.selection-card.chosen { background:var(--selection); border-color:var(--selection-border); box-shadow:inset 0 0 0 .5px var(--selection-border); }
.selection-icon { width:21px; height:21px; flex-shrink:0; opacity:.85; }
.selection-copy { flex:1; min-width:0; }
.selection-title { display:block; font-size:14px; line-height:1.65; letter-spacing:.15px; }
.selection-detail { display:block; font-size:12px; line-height:1.7; margin-top:3px; color:var(--muted); }
.selection-check { display:flex; align-items:center; justify-content:center; width:18px; height:18px; flex-shrink:0; opacity:0; transform:scale(.7); transition:opacity 120ms,transform 160ms var(--ease-out); }
.selection-check.visible { opacity:1; transform:scale(1); }
.selection-radio { width:20px; height:20px; border:1px solid var(--muted); border-radius:50%; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.selection-radio.checked { border-color:var(--ink); }
.selection-radio > view { width:10px; height:10px; border-radius:50%; background:var(--ink); transform:scale(0); transition:transform 160ms var(--ease-out); }
.selection-radio.checked > view { transform:scale(1); }
.detailed { min-height:76px; }
.selection-pressed, .selection-card:active { transform:scale(.985); }
@media (prefers-reduced-motion: reduce) { .selection-card { transition:none; } }
</style>

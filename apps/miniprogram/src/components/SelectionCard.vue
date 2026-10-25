<script setup lang="ts">
import SvgIcon from './SvgIcon.vue'
withDefaults(defineProps<{ title: string; detail?: string; icon?: string; selected?: boolean; radio?: boolean; inlineIcon?: boolean }>(), { selected: false })
defineEmits<{ select: [] }>()
</script>

<template>
  <button
    class="selection-card"
    :class="{ chosen: selected, compact: !detail, 'inline-icon': inlineIcon }"
    :aria-pressed="selected"
    hover-class="selection-pressed"
    :hover-start-time="0"
    :hover-stay-time="70"
    @click="$emit('select')"
  >
    <view v-if="icon && !inlineIcon" class="selection-icon-tile" aria-hidden="true">
      <SvgIcon :name="icon" :size="22" tone="ink" />
    </view>
    <view class="selection-copy">
      <view class="selection-title-row"><SvgIcon v-if="icon && inlineIcon" :name="icon" :size="20" tone="ink" /><text class="selection-title">{{ title }}</text></view>
      <text v-if="detail" class="selection-detail">{{ detail }}</text>
    </view>
    <view v-if="radio" class="selection-radio" :class="{ checked: selected }" aria-hidden="true"><view /></view>
    <view v-else class="selection-control" :class="{ checked: selected }" aria-hidden="true">
      <view class="selection-check-mark" />
    </view>
  </button>
</template>

<style scoped>
.selection-card {
  display:flex; align-items:center; gap:13px; width:100%; min-height:78px; margin:0; padding:14px 15px;
  box-sizing:border-box; border:1px solid var(--quiet-border); border-radius:17px;
  background:var(--quiet-surface); box-shadow:var(--quiet-shadow); color:var(--quiet-title);
  text-align:left; touch-action:manipulation;
  transition:background-color 130ms var(--ease-out),border-color 130ms var(--ease-out);
}
.selection-card::after { border:0; }
.selection-card.compact { min-height:64px; padding:12px 15px; }
.selection-card.chosen {
  background:var(--quiet-surface-selected); border-color:var(--quiet-border-selected);
  box-shadow:var(--quiet-shadow-selected),inset 0 0 0 .5px var(--quiet-border-selected);
}
.selection-icon-tile {
  display:flex; align-items:center; justify-content:center; width:42px; height:42px; flex-shrink:0;
  border-radius:13px; background:var(--quiet-tile);
  transition:background-color 160ms var(--ease-out);
}
.selection-card.chosen .selection-icon-tile { background:var(--quiet-tile-selected); }
.selection-copy { flex:1; min-width:0; padding:1px 0; }
.selection-title-row { display:flex; align-items:center; gap:8px; }
.selection-title-row .selection-title { flex:1; min-width:0; }
.selection-card.inline-icon { align-items:center; gap:10px; }
.inline-icon .selection-detail { margin-top:7px; }
.selection-title { display:block; font-size:14.5px; font-weight:500; line-height:1.55; letter-spacing:.1px; color:var(--quiet-title); }
.selection-detail { display:block; font-size:12.5px; line-height:1.72; letter-spacing:.05px; margin-top:3px; color:var(--quiet-detail); }
.selection-control {
  display:flex; align-items:center; justify-content:center; width:22px; height:22px; flex-shrink:0;
  border:1px solid var(--quiet-control); border-radius:6px; background:transparent;
  transition:background-color 130ms var(--ease-out),border-color 130ms var(--ease-out);
}
.selection-control.checked { background:var(--quiet-check); border-color:var(--quiet-check); }
.selection-check-mark { width:5px; height:9px; margin-top:-3px; border-right:1.5px solid var(--quiet-check-ink); border-bottom:1.5px solid var(--quiet-check-ink); transform:rotate(45deg); visibility:hidden; }
.checked .selection-check-mark { visibility:visible; }
.selection-radio {
  width:22px; height:22px; flex-shrink:0; display:flex; align-items:center; justify-content:center;
  border:1px solid var(--quiet-control); border-radius:50%;
  transition:border-color 160ms var(--ease-out);
}
.selection-radio.checked { border-color:var(--quiet-check); }
.selection-radio > view {
  width:10px; height:10px; border-radius:50%; background:var(--quiet-check);
  visibility:hidden;
}
.selection-radio.checked > view { visibility:visible; }
.selection-pressed, .selection-card:active { background:var(--quiet-surface-pressed); }
.selection-card.chosen.selection-pressed, .selection-card.chosen:active { background:var(--quiet-surface-selected); }
@media(max-width:360px) {
  .selection-card { gap:12px; min-height:74px; padding:13px 14px; border-radius:16px; }
  .selection-card.compact { min-height:62px; padding:11px 14px; }
  .selection-icon-tile { width:40px; height:40px; border-radius:12px; }
  .selection-title { font-size:14px; }
  .selection-detail { font-size:12px; }
}
@media(prefers-reduced-motion:reduce) {
  .selection-card, .selection-icon-tile, .selection-control, .selection-radio, .selection-radio > view { transition:none; }
  .selection-pressed, .selection-card:active { transform:none; }
}
</style>

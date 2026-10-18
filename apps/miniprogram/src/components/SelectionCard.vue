<script setup lang="ts">
import SvgIcon from './SvgIcon.vue'
withDefaults(defineProps<{ title: string; detail?: string; icon?: string; selected?: boolean; radio?: boolean; artwork?: string; tone?: string }>(), { selected: false })
defineEmits<{ select: [] }>()
</script>
<template>
  <button class="selection-card" :class="[{ chosen: selected, detailed: detail, scenic: artwork }, 'tone-' + (tone || 'sage')]" :aria-pressed="selected" hover-class="selection-pressed" :hover-start-time="0" :hover-stay-time="70" @click="$emit('select')">
    <view v-if="artwork" class="selection-art" aria-hidden="true">
      <image :src="artwork" mode="aspectFill" />
      <view v-if="icon" class="selection-art-icon"><SvgIcon :name="icon" :size="17" /></view>
    </view>
    <view v-if="radio && !artwork" class="selection-radio" :class="{ checked: selected }"><view /></view>
    <view class="selection-copy">
      <view class="selection-heading">
        <SvgIcon v-if="!radio && icon && !artwork" class="selection-icon" :name="icon" :size="21" />
        <text class="selection-title">{{ title }}</text>
      </view>
      <text v-if="detail" class="selection-detail" :class="{ 'with-icon': !radio && icon && !artwork }">{{ detail }}</text>
    </view>
    <view v-if="!radio || artwork" class="selection-check" :class="{ visible: selected }"><SvgIcon v-if="selected" name="check" :size="16" /></view>
  </button>
</template>
<style scoped>
.selection-card { display:flex; align-items:center; gap:13px; width:100%; min-height:57px; margin:0; padding:15px 16px; background:var(--paper); border:1px solid var(--line); border-radius:8px; color:var(--ink); text-align:left; box-sizing:border-box; transition:background var(--motion-press),border-color var(--motion-press),transform var(--motion-press); touch-action:manipulation; }
.selection-card::after { border:0; }
.selection-card.chosen { background:var(--selection); border-color:var(--selection-border); box-shadow:inset 0 0 0 .5px var(--selection-border); }
.selection-icon { width:21px; height:21px; flex-shrink:0; opacity:.85; }
.selection-copy { flex:1; min-width:0; }
.selection-heading { display:flex; align-items:center; gap:13px; }
.selection-heading .selection-title { flex:1; min-width:0; }
.selection-detail.with-icon { margin-left:34px; }
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

.scenic { --card-accent:#476951; --card-tint:#e8f0e3; position:relative; gap:15px; min-height:104px; border:1px solid rgba(255,255,255,.95); border-radius:21px; padding:13px 15px 13px 12px; background:rgba(255,253,247,.87); box-shadow:0 5px 20px rgba(46,66,53,.045); }
.scenic.tone-water { --card-accent:#3f6a70; --card-tint:#e3eeed; }
.scenic.tone-rose { --card-accent:#98624d; --card-tint:#f5e9df; }
.scenic.tone-gold { --card-accent:#8b702f; --card-tint:#f3eddb; }
.scenic.tone-lilac { --card-accent:#726783; --card-tint:#ede8f1; }
.selection-art { position:relative; width:64px; height:70px; border-radius:15px; flex-shrink:0; background:var(--card-tint); }
.selection-art > image { width:100%; height:100%; border-radius:15px; }
.selection-art-icon { position:absolute; right:-5px; bottom:-4px; display:flex; align-items:center; justify-content:center; width:28px; height:28px; border-radius:50%; background:var(--card-tint); border:2px solid #fffdf7; }
.scenic .selection-title { color:#304738; font-size:15px; font-weight:500; line-height:1.65; }
.scenic .selection-detail { color:#6b766a; font-size:12px; line-height:1.7; margin-top:5px; }
.scenic .selection-check { width:20px; height:20px; border-radius:50%; border:1px solid #b7c4ad; opacity:1; transform:none; background:rgba(255,255,255,.55); }
.scenic .selection-check :deep(.svg-icon) { opacity:0; }
.scenic .selection-check.visible { background:var(--card-tint); border-color:var(--card-accent); }
.scenic .selection-check.visible :deep(.svg-icon) { opacity:1; }
.scenic.chosen { background:var(--card-tint); border-color:var(--card-accent); box-shadow:0 4px 18px rgba(55,83,61,.09),inset 0 0 0 .5px var(--card-accent); }
.scenic.chosen .selection-title { color:var(--card-accent); }
@media(max-width:360px) { .scenic { gap:12px; padding-right:12px; } .selection-art { width:52px; height:62px; } .scenic .selection-title { font-size:14px; } .scenic .selection-detail { font-size:11px; } }
</style>

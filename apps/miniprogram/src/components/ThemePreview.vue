<script setup lang="ts">
import { computed } from 'vue'
import { themeStyle } from '../themes'
import type { ThemeDefinition } from '../themes'
const props = defineProps<{ theme: ThemeDefinition }>()
const style = computed(() => themeStyle(props.theme))
</script>
<template>
  <view class="theme-miniature" :style="style" aria-hidden="true">
    <image :src="theme.image" mode="aspectFill" />
    <view class="mini-wash" />
    <view class="mini-heading"><text>给自己一点空间</text><view /></view>
    <view class="mini-mission"><view /><view /></view>
    <view class="mini-focus"><view v-for="i in 2" :key="i"><view /><view /></view></view>
    <view class="mini-nav"><view v-for="i in 5" :key="i" :class="{ middle:i === 3, selected:i === 1 }" /></view>
  </view>
</template>
<style scoped>
.theme-miniature { position:relative; height:188px; overflow:hidden; background:var(--bg); color:var(--ink); }
.theme-miniature > image { position:absolute; inset:0; width:100%; height:138px; }
.mini-wash { position:absolute; inset:0; background:linear-gradient(180deg,var(--hero-top),transparent 38%,var(--bg) 80%); }
.mini-heading { position:absolute; top:12px; left:12px; }
.mini-heading text { display:block; font-size:10px; font-family:'Kaiti SC','STKaiti','KaiTi',serif; }
.mini-heading > view { margin-top:5px; width:37px; height:2px; background:var(--muted); opacity:.35; border-radius:2px; }
.mini-mission,.mini-focus { position:absolute; left:10px; right:10px; background:var(--surface-glass); border:1px solid var(--paper); border-radius:9px; padding:8px; }
.mini-mission { top:91px; height:27px; }
.mini-mission > view { width:60%; height:3px; background:var(--ink); opacity:.5; border-radius:3px; margin-bottom:4px; }
.mini-mission > view:last-child { width:42%; height:2px; opacity:.2; }
.mini-focus { top:124px; height:38px; padding:5px 8px; }
.mini-focus > view { display:flex; align-items:center; gap:6px; height:13px; }
.mini-focus > view > view:first-child { width:6px; height:6px; border-radius:50%; background:var(--accent); opacity:.55; }
.mini-focus > view > view:last-child { width:57%; height:2px; border-radius:2px; background:var(--muted); opacity:.35; }
.mini-nav { position:absolute; bottom:0; left:0; right:0; height:20px; background:var(--nav-glass); display:flex; align-items:center; justify-content:space-around; }
.mini-nav > view { width:5px; height:5px; border:1px solid var(--muted); border-radius:2px; }
.mini-nav > .selected { background:var(--accent); border-color:var(--accent); }
.mini-nav > .middle { width:18px; height:18px; margin-top:-10px; border:2px solid var(--bg); border-radius:50%; background:linear-gradient(140deg,var(--nav-start),var(--button-fill),var(--nav-end)); }
</style>

<script setup lang="ts">
import SvgIcon from './SvgIcon.vue'
defineOptions({ options: { styleIsolation: 'apply-shared' } })
defineProps<{ id: string; title: string; summary: string; open: boolean }>()
const emit = defineEmits<{ toggle: [] }>()
</script>
<template>
  <view class="me-accordion" :class="{ 'is-open': open }">
    <button :id="id + '-trigger'" class="me-accordion-trigger" :aria-expanded="open" :aria-controls="id + '-body'"
            @click="emit('toggle')" hover-class="pressed" :hover-start-time="0" :hover-stay-time="70">
      <view class="me-accordion-label"><text class="setting-title me-accordion-title">{{ title }}</text><text class="setting-description me-accordion-summary">{{ summary }}</text></view>
      <view class="me-accordion-chevron" aria-hidden="true"><SvgIcon name="chevron" :size="17" /></view>
    </button>
    <view :id="id + '-body'" class="me-accordion-body" :aria-hidden="!open" :aria-labelledby="id + '-trigger'">
      <view class="me-accordion-inner"><view class="me-accordion-content"><slot /></view></view>
    </view>
  </view>
</template>
<style scoped lang="scss">
.me-accordion { border-bottom:1px solid var(--line); font-family:var(--font-body); }
.me-accordion-trigger { display:flex; align-items:center; justify-content:space-between; gap:16px; width:100%; min-height:78px; padding:16px 0; margin:0; border:0; border-radius:0; background:transparent; text-align:left; color:var(--ink); font-family:var(--font-body); font-size:var(--type-body); font-weight:400; line-height:1.6; }
.me-accordion-label { flex:1; min-width:0; }
.me-accordion-title { font-family:var(--font-body); font-size:var(--type-body); font-weight:400; line-height:1.6; }
.me-accordion-summary { font-family:var(--font-body); font-size:var(--type-subtitle); font-weight:400; line-height:1.75; margin-top:5px; color:var(--muted); }
.me-accordion-chevron { flex:0 0 20px; display:flex; align-items:center; justify-content:center; transition:transform 200ms var(--ease-out,ease); }
.is-open .me-accordion-chevron { transform:rotate(90deg); }
.me-accordion-body { display:grid; grid-template-rows:0fr; opacity:0; visibility:hidden; transition:grid-template-rows 220ms var(--ease-out,ease),opacity 160ms ease,visibility 220ms; }
.is-open .me-accordion-body { grid-template-rows:1fr; opacity:1; visibility:visible; }
.me-accordion-inner { min-height:0; overflow:hidden; }
.me-accordion-content { padding:0 0 18px 16px; }
@media(prefers-reduced-motion:reduce) { .me-accordion-body,.me-accordion-chevron { transition:none; } }
</style>

<script setup lang="ts">
defineProps<{ current: number; total: number; accent?: boolean }>()
</script>
<template><view class="progress-indicator" :class="{ 'progress-accent': accent }"><view class="progress-track"><view class="progress-fill" :style="{ transform: `scaleX(${current / total})` }" /></view><text class="progress-count">{{ String(current).padStart(2, '0') }} <text class="progress-total">/ {{ String(total).padStart(2, '0') }}</text></text></view></template>
<style scoped>
.progress-indicator { display:flex; align-items:center; gap:22px; width:100%; margin:0; font-size:11px; color:var(--ink); letter-spacing:1px; }
.progress-track { height:2px; flex:1; background:var(--line); border-radius:3px; overflow:hidden; }
.progress-fill { width:100%; height:100%; background:var(--ink); border-radius:3px; transform-origin:left; transition:transform 240ms var(--ease-out); }
.progress-count { flex-shrink:0; font-variant-numeric:tabular-nums; }.progress-total { color:var(--muted); }
.progress-accent .progress-track { height:3px; background:var(--quiet-border,var(--line)); box-shadow:inset 0 1px 1px rgba(25,40,65,.05); }
.progress-accent .progress-fill { background:linear-gradient(90deg,var(--accent),var(--cta-highlight,var(--accent))); transition:transform 480ms cubic-bezier(.22,.72,.18,1); }
.progress-accent .progress-count { color:var(--muted); font-size:12px; }
@media (prefers-reduced-motion: reduce) { .progress-fill, .progress-accent .progress-fill { transition:none; } }
</style>

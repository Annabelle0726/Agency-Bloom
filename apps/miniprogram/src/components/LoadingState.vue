<script setup lang="ts">
withDefaults(defineProps<{ text?: string }>(), { text: '正在整理，请稍等…' })
</script>
<template><view class="loading-state"><view class="loading-dot" /><text>{{ text }}</text></view></template>
<style scoped>.loading-state {display:flex;align-items:center;justify-content:center;gap:10px;padding:20px;font-size:13px;color:var(--muted)}.loading-dot {width:7px;height:7px;border-radius:50%;background:var(--muted);animation:pulse 1.2s ease infinite}@keyframes pulse {50%{opacity:.3}}@media(prefers-reduced-motion:reduce){.loading-dot{animation:none}}</style>

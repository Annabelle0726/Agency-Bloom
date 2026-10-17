<script setup lang="ts">
import SvgIcon from './SvgIcon.vue'
defineProps<{ title: string; description?: string }>()
</script>
<template><view class="empty-state"><SvgIcon name="note" :size="25" /><text>{{ title }}</text><text v-if="description" class="empty-description">{{ description }}</text></view></template>
<style scoped>.empty-state { display:flex; flex-direction:column; gap:12px; align-items:center; padding:30px 15px; color:var(--muted); font-size:12px; line-height:1.8; text-align:center; }.empty-state .svg-icon { opacity:.5; }.empty-description { font-size:11px; }</style>

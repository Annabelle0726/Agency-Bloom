<script setup lang="ts">
import SvgIcon from './SvgIcon.vue'
withDefaults(defineProps<{ kind?: 'primary' | 'secondary' | 'ghost' | 'wechat'; loading?: boolean; disabled?: boolean; locked?: boolean; arrow?: boolean }>(), { kind: 'primary', arrow: true })
defineEmits<{ click: [] }>()
</script>
<template>
  <button class="action-button" :class="[`action-${kind}`, { 'is-loading': loading, 'has-arrow': arrow, 'is-locked': locked && !disabled }]" :disabled="disabled || loading || locked" :loading="loading" hover-class="action-pressed" :hover-start-time="0" :hover-stay-time="70" @click="!disabled && !loading && !locked && $emit('click')">
    <text class="action-label"><slot /></text><view v-if="arrow && !loading" class="action-arrow"><SvgIcon name="arrow" :light="kind === 'primary' || kind === 'wechat'" :size="22" /></view>
  </button>
</template>

<style scoped>
.action-button { display:flex; align-items:center; justify-content:center; gap:14px; width:100%; min-height:58px; margin:0; padding:11px 18px 11px 24px; box-sizing:border-box; border-radius:var(--radius-button); font-size:15px; font-weight:500; line-height:1.6; transition:transform var(--motion-press), opacity var(--motion-press), background var(--motion-press); touch-action:manipulation; }
.has-arrow { justify-content:space-between; }
.action-label { display:block; letter-spacing:.5px; }
.action-button::after { border: none; }
.action-primary { background:var(--button-fill); color:#fff; box-shadow:0 5px 15px #27364c0d; }
.action-secondary { background: var(--paper); color: var(--ink); border: 1px solid var(--line); }
.action-ghost { background: transparent; color: var(--muted); font-size: 13px; }
.action-wechat { background: #34634b; color: #fff; border-radius: 8px; border:1px solid #34634b; }
.action-button[disabled] { background:var(--disabled-fill); color:var(--muted); opacity:1; box-shadow:none; }
.action-button[disabled] .action-arrow { opacity:.45; }
.action-wechat[disabled] { background:#e8eee5; border-color:#d7e0d3; color:#60725e; }
.action-primary.is-locked[disabled] { background:var(--button-fill); color:#fff; }
.action-secondary.is-locked[disabled] { background:var(--paper); color:var(--ink); }
.is-locked[disabled] .action-arrow { opacity:1; }
.action-ghost[disabled] { background: transparent; color: var(--muted); }
.action-arrow { width:34px; height:34px; display:flex; align-items:center; justify-content:center; border:1px solid #ffffff30; border-radius:50%; flex-shrink:0; transition:transform var(--motion-press); }
.action-secondary .action-arrow { border-color:#29374b24; }
.action-pressed, .action-button:active:not([disabled]) { transform:scale(.983); }
.action-pressed .action-arrow { transform:translateX(2px); }
@media (prefers-reduced-motion: reduce) { .action-button { transition: none; } }
</style>

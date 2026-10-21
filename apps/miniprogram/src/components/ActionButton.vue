<script setup lang="ts">
import SvgIcon from './SvgIcon.vue'
withDefaults(defineProps<{ kind?: 'primary' | 'secondary' | 'ghost' | 'wechat' | 'quiet'; loading?: boolean; disabled?: boolean; locked?: boolean; arrow?: boolean }>(), { kind: 'primary', arrow: true })
defineEmits<{ click: [] }>()
</script>
<template>
  <button class="action-button" :class="[`action-${kind}`, { 'is-loading': loading, 'has-arrow': arrow, 'is-locked': locked && !disabled }]" :disabled="disabled || loading || locked" :loading="loading" hover-class="action-pressed" :hover-start-time="0" :hover-stay-time="70" @click="!disabled && !loading && !locked && $emit('click')">
    <text class="action-label"><slot /></text><view v-if="arrow && !loading" class="action-arrow"><SvgIcon name="arrow" :light="(kind === 'primary' || kind === 'wechat' || kind === 'quiet') && (!disabled || locked)" :tone="disabled && !locked ? 'muted' : 'ink'" :size="22" /></view>
  </button>
</template>

<style scoped>
.action-button { display:flex; align-items:center; justify-content:center; gap:14px; width:100%; min-height:58px; margin:0; padding:11px 18px 11px 24px; box-sizing:border-box; border-radius:var(--radius-button); font-size:15px; font-weight:500; line-height:1.6; transition:transform var(--motion-press), opacity var(--motion-press), background var(--motion-press), box-shadow var(--motion-press); touch-action:manipulation; }
.has-arrow { justify-content:space-between; }
.action-label { display:block; letter-spacing:.5px; }
.action-button::after { border: none; }
.action-primary {
  border:1px solid var(--nav-gem-hi-soft, rgba(255,255,255,.5));
  background:linear-gradient(150deg,var(--nav-gem-hi) 0%,var(--nav-start) 30%,var(--button-fill) 60%,var(--nav-gem-deep) 100%);
  color:#fff;
  text-shadow:0 1px 2px rgba(10,18,34,.3);
  box-shadow:0 3px 14px var(--theme-glow), inset 0 1px 2px var(--nav-gem-hi-soft, rgba(255,255,255,.5)), inset 0 -2px 4px rgba(10,18,34,.3);
}
.action-secondary { background: var(--paper); color: var(--ink); border: 1px solid var(--line); }
.action-ghost { background: transparent; color: var(--muted); font-size: 13px; }
.action-wechat { background: #34634b; color: #fff; border-radius: 8px; border:1px solid #34634b; }
.action-quiet {
  min-height:56px; border:1px solid var(--cta-border); border-radius:16px;
  background:linear-gradient(180deg,var(--cta-highlight) 0%,var(--cta-fill) 38%,var(--cta-deep) 100%);
  color:var(--cta-ink); text-shadow:none; box-shadow:var(--cta-shadow);
}
.action-quiet .action-arrow { border-color:rgba(255,255,255,.26); }
.action-button[disabled] { background:var(--disabled-fill); color:var(--muted); opacity:1; box-shadow:none; }
.action-button[disabled] .action-arrow { opacity:.45; }
.action-quiet[disabled] { background:var(--cta-disabled); border-color:transparent; color:var(--muted); box-shadow:none; }
.action-quiet[disabled] .action-arrow { opacity:.5; }
.action-quiet.is-locked[disabled] {
  background:linear-gradient(180deg,var(--cta-highlight) 0%,var(--cta-fill) 38%,var(--cta-deep) 100%);
  border-color:var(--cta-border); color:var(--cta-ink); opacity:.72;
}
.action-quiet.is-locked[disabled] .action-arrow { opacity:1; }
.action-wechat[disabled] { background:#e8eee5; border-color:#d7e0d3; color:#60725e; }
.action-primary.is-locked[disabled] {
  background:linear-gradient(150deg,var(--nav-gem-hi) 0%,var(--nav-start) 30%,var(--button-fill) 60%,var(--nav-gem-deep) 100%);
  color:#fff; box-shadow:0 2px 8px rgba(10,18,34,.14), inset 0 1px 1px rgba(255,255,255,.3);
}
.action-secondary.is-locked[disabled] { background:var(--paper); color:var(--ink); }
.is-locked[disabled] .action-arrow { opacity:1; }
.action-ghost[disabled] { background: transparent; color: var(--muted); }
.action-arrow { width:34px; height:34px; display:flex; align-items:center; justify-content:center; border:1px solid #ffffff30; border-radius:50%; flex-shrink:0; transition:transform var(--motion-press); }
.action-secondary .action-arrow { border-color:#29374b24; }
.action-pressed, .action-button:active:not([disabled]) { transform:scale(.98); }
.action-pressed .action-arrow { transform:translateX(2px); }
.action-pressed.action-primary, .action-button.action-primary:active:not([disabled]) {
  box-shadow:0 4px 20px var(--nav-gem-glow, rgba(255,255,255,.42)), 0 2px 5px rgba(24,36,54,.28), inset 0 0 12px var(--nav-gem-hi-soft, rgba(255,255,255,.5)), inset 0 1px 2px rgba(255,255,255,.8);
}
.action-pressed.action-quiet, .action-button.action-quiet:active:not([disabled]) {
  border-color:var(--cta-pressed-border);
  box-shadow:var(--cta-pressed-shadow),inset 0 1px 1px rgba(255,255,255,.24),inset 0 0 0 1px var(--cta-pressed-border);
}
@media (prefers-reduced-motion: reduce) { .action-button { transition: none; } }
</style>

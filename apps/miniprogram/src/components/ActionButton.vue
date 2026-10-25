<script setup lang="ts">
import SvgIcon from './SvgIcon.vue'
withDefaults(defineProps<{ kind?: 'primary' | 'secondary' | 'ghost' | 'wechat' | 'quiet' | 'opening' | 'auth-wechat' | 'auth-demo'; loading?: boolean; disabled?: boolean; locked?: boolean; arrow?: boolean; stablePress?: boolean }>(), { kind: 'primary', arrow: true })
defineEmits<{ click: [] }>()
</script>
<template>
  <button class="action-button" :class="[`action-${kind}`, { 'is-loading': loading, 'has-arrow': arrow, 'is-locked': locked && !disabled, 'stable-press': stablePress }]" :disabled="disabled || loading || locked" :loading="loading" hover-class="action-pressed" :hover-start-time="0" :hover-stay-time="70" @click="!disabled && !loading && !locked && $emit('click')">
    <text class="action-label"><slot /></text><view v-if="arrow && !loading" class="action-arrow"><SvgIcon :name="kind === 'auth-wechat' || kind === 'auth-demo' ? 'chevron' : 'arrow'" :light="(kind === 'primary' || kind === 'wechat' || kind === 'quiet' || kind === 'auth-wechat') && (!disabled || locked)" :tone="disabled && !locked ? 'muted' : 'ink'" :color="kind === 'opening' ? '#514331' : undefined" :size="kind === 'auth-wechat' || kind === 'auth-demo' ? 18 : 22" /></view>
  </button>
</template>

<style scoped>
.action-button { display:flex; align-items:center; justify-content:center; gap:14px; width:100%; min-height:58px; margin:0; padding:11px 18px 11px 24px; box-sizing:border-box; border-radius:var(--radius-button); font-family:var(--font-body); font-size:var(--type-button); font-weight:500; line-height:1.6; transition:transform var(--motion-press), opacity var(--motion-press), background var(--motion-press), box-shadow var(--motion-press); touch-action:manipulation; }
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
/* Opening-only champagne finish echoes the meadow sunlight. */
.action-opening {
  position:relative; overflow:hidden; justify-content:center; gap:18px;
  min-height:54px; padding:13px 26px; border-radius:var(--radius-button);
  border:1px solid rgba(255,244,211,.85);
  background:linear-gradient(165deg,#fff7e3 0%,#f3e3bd 38%,#ddc493 100%);
  color:#514331; font-size:var(--type-button); font-weight:500; text-shadow:0 1px 0 rgba(255,255,255,.5);
  box-shadow:0 7px 18px rgba(17,27,20,.23),0 2px 4px rgba(17,27,20,.12),inset 0 1px 0 rgba(255,255,255,.9),inset 0 -2px 3px rgba(141,107,53,.16);
  transition:transform 150ms ease,box-shadow 150ms ease;
}
.action-opening::before {
  content:''; position:absolute; inset:1px; border-radius:inherit; pointer-events:none;
  border:1px solid rgba(255,253,242,.24);
  background:linear-gradient(180deg,rgba(255,255,255,.23),rgba(255,255,255,0) 48%);
}
.action-opening .action-label { position:relative; font-family:inherit; letter-spacing:.5px; }
.action-opening .action-arrow { position:relative; width:22px; height:22px; border:0; border-radius:0; transition:transform 150ms ease; }
.action-opening.action-pressed, .action-opening:active:not([disabled]) {
  transform:translateY(1px) scale(.985);
  box-shadow:0 3px 8px rgba(17,27,20,.22),inset 0 1px 3px rgba(141,107,53,.18),inset 0 1px 0 rgba(255,255,255,.5);
}
.action-opening:focus-visible { outline:2px solid #fff9e9; outline-offset:4px; }
/* Auth-only finishes follow the mountain mist and warm morning light. */
.action-auth-wechat, .action-auth-demo {
  position:relative; overflow:hidden; justify-content:space-between; gap:16px;
  min-height:54px; padding:11px 18px 11px 20px; border-radius:8px;
  font-size:var(--type-button); font-weight:500;
  transition:transform 130ms cubic-bezier(.23,1,.32,1),background 130ms ease-out,box-shadow 130ms ease-out;
}
.action-auth-wechat {
  background:linear-gradient(155deg,#426974,#284b56 65%,#233f49);
  color:#fff; border:1px solid rgba(214,233,233,.42); text-shadow:none;
  box-shadow:0 5px 14px rgba(30,58,66,.13),inset 0 1px 0 rgba(255,255,255,.18);
}
.action-auth-demo {
  background:var(--paper); color:var(--ink); border:1px solid var(--line); text-shadow:none;
  box-shadow:0 1px 2px rgba(41,55,75,.04);
}
.action-auth-wechat::before, .action-auth-demo::before {
  content:none;
}
.action-auth-wechat .action-label, .action-auth-demo .action-label { position:relative; flex:1; min-width:0; text-align:left; font-family:inherit; letter-spacing:.2px; }
.action-auth-wechat .action-arrow, .action-auth-demo .action-arrow { position:relative; width:24px; height:24px; border:0; border-radius:0; background:transparent; transition:transform 130ms cubic-bezier(.23,1,.32,1); }
.action-auth-demo .action-arrow { border:0; background:transparent; }
.action-auth-wechat[disabled], .action-auth-demo[disabled] { background:var(--soft); border-color:var(--line); color:var(--muted); text-shadow:none; box-shadow:none; }
.action-auth-wechat[disabled] .action-arrow, .action-auth-demo[disabled] .action-arrow { opacity:1; border-color:var(--line); background:transparent; }
.action-auth-wechat.action-pressed:not([disabled]), .action-auth-demo.action-pressed:not([disabled]),
.action-auth-wechat:active:not([disabled]), .action-auth-demo:active:not([disabled]) {
  transform:translateY(1px) scale(.98);
  box-shadow:0 1px 3px rgba(41,55,75,.09);
}
.action-auth-wechat:focus-visible, .action-auth-demo:focus-visible { outline:2px solid #526e7c; outline-offset:3px; }
/* Scrollable onboarding keeps press feedback on the painted control only. */
.action-button.stable-press { transition:background-color 130ms var(--ease-out),border-color 130ms var(--ease-out); }
.action-button.stable-press.action-pressed, .action-button.stable-press:active:not([disabled]),
.stable-press .action-arrow, .stable-press.action-pressed .action-arrow { transform:none; }
.action-button.stable-press.is-locked[disabled] { opacity:1; }
@media (prefers-reduced-motion: reduce) {
  .action-button, .action-opening .action-arrow, .action-auth-wechat .action-arrow, .action-auth-demo .action-arrow { transition:none; }
}
</style>

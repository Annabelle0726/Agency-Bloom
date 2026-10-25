<script setup lang="ts">
import ModalShell from './ModalShell.vue'
import SvgIcon from '../../../components/SvgIcon.vue'
defineOptions({ options: { styleIsolation: 'apply-shared' } })
defineProps<{ busy: boolean }>()
const emit=defineEmits<{ close: []; replace: []; explore: [] }>()
</script>
<template>
  <ModalShell title="想怎样换个方向？" :busy="busy" @close="emit('close')">
    <text class="body-copy">可以换一种做法，也可以重新选择想探索的问题</text>
    <button class="plan-direction-option" :disabled="busy" @click="emit('replace')" hover-class="pressed" :hover-start-time="0">
      <SvgIcon name="paths" :size="22" tone="accent" /><view><text class="plan-direction-title">围绕这件事，换个尝试</text><text class="plan-direction-note">重新写下一步；还没想好也可以先留空，确认后再更新</text></view>
    </button>
    <button class="plan-direction-option" :disabled="busy" @click="emit('explore')" hover-class="pressed" :hover-start-time="0">
      <SvgIcon name="compass" :size="22" tone="accent" /><view><text class="plan-direction-title">换一个问题，开始新的探索</text><text class="plan-direction-note">原来的探索和记录会保留，之后仍可以回来</text></view>
    </button>
    <text class="muted small">更换尝试不会把旧的一步标成完成，也不会删除已留下的经历</text>
  </ModalShell>
</template>
<style scoped>
.plan-direction-option{display:flex;align-items:center;gap:14px;width:100%;padding:16px;margin:16px 0;border:1px solid var(--line);border-radius:8px;background:var(--soft);color:var(--ink);text-align:left;white-space:normal;}
.plan-direction-option::after{border:0;}
.plan-direction-option>view{flex:1;min-width:0;}
.plan-direction-title{display:block;font-size:15px;line-height:1.6;}
.plan-direction-note{display:block;margin-top:5px;font-size:13px;line-height:1.7;color:var(--muted);}
</style>

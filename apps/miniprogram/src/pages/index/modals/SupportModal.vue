<script setup lang="ts">
import ModalShell from './ModalShell.vue'
import { supportStyles } from '../../../onboarding'

defineOptions({ options: { styleIsolation: 'apply-shared' } })

defineProps<{
  busy: boolean
  sending: boolean
  selected: string
  error?: string
}>()
const emit = defineEmits<{ close: []; select: [mode: string] }>()
</script>

<template>
  <ModalShell title="此刻，希望怎样被支持" :busy="busy" :error="error" @close="emit('close')">
    <button v-for="item in supportStyles" :key="item.id" class="support-setting"
            :class="{ selected: selected === item.id }" :disabled="busy || sending"
            @click="emit('select', item.id)" hover-class="pressed" :hover-start-time="0"
            :hover-stay-time="70">
      <text>{{ item.title }}</text>
      <text class="muted small">{{ item.detail }}</text>
    </button>
  </ModalShell>
</template>

<script setup lang="ts">
import SvgIcon from '../../../components/SvgIcon.vue'
import ModalShell from './ModalShell.vue'
import { editFields } from '../data'

defineOptions({ options: { styleIsolation: 'apply-shared' } })

defineProps<{
  busy: boolean
  error?: string
  editor: {
    title: string
    options: string
    constraints: string
    confirmed: string
    hypotheses: string
    unknowns: string
    next_step: string
  }
}>()
const emit = defineEmits<{ close: []; save: []; reload: [] }>()
</script>

<template>
  <ModalShell title="这张卡片，由你确认" :busy="busy" :error="error" @close="emit('close')">
    <text class="muted small">这些内容只有保存后才会成为下次接续的依据，列表每行一项</text>
    <text class="field-label">当前问题</text>
    <input v-model="editor.title" class="text-field" maxlength="120"/>
    <view v-for="field in editFields" :key="field.key">
      <text class="field-label">{{ field.label }}</text>
      <textarea v-model="editor[field.key]" class="text-area compact" :placeholder="field.hint"
                maxlength="4800" :auto-height="true"/></view>
    <text class="field-label">我愿意尝试的下一步</text>
    <textarea v-model="editor.next_step" class="text-area compact" maxlength="600"/>
    <button v-if="error" class="text-button" @click="emit('reload')" hover-class="pressed"
            :hover-start-time="0" :hover-stay-time="70">读取最新卡片版本，保留当前编辑
    </button>
    <button class="primary" :disabled="busy" :loading="busy" @click="emit('save')"
            hover-class="pressed" :hover-start-time="0" :hover-stay-time="70">确认这些内容并保存
      <SvgIcon name="check" light :size="19"/>
    </button>
  </ModalShell>
</template>

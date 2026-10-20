<script setup lang="ts">
import SvgIcon from '../../../components/SvgIcon.vue'
import ModalShell from './ModalShell.vue'
import { experimentFields } from '../data'
import type { Experiment } from '../../../domain'

defineOptions({ options: { styleIsolation: 'apply-shared' } })

defineProps<{
  busy: boolean
  canSave: boolean
  error?: string
  editor: Experiment
}>()
const emit = defineEmits<{ close: []; save: [] }>()
</script>

<template>
  <ModalShell title="先试一点，由你决定" :busy="busy" :error="error" @close="emit('close')">
    <text class="body-copy">这是一份可以修改的小实验草稿，确认后才会替换卡片中的下一步，其他已确认信息保持不变</text>
    <view v-for="field in experimentFields" :key="field.key"><text class="field-label">{{ field.label }}</text><textarea v-model="editor[field.key]" class="text-area compact experiment-input" :data-experiment="field.key" :maxlength="field.max" :auto-height="true" /></view>
    <text v-if="!canSave" class="muted small">请填写四项内容，合计不超过 600 字；也可以先关闭，继续想想</text>
    <button class="primary confirm-experiment" :disabled="busy || !canSave" :loading="busy" @click="emit('save')" hover-class="pressed" :hover-start-time="0" :hover-stay-time="70">确认，把这个小实验留在卡片里 <SvgIcon name="check" light :size="19" /></button>
    <button class="text-button wide" :disabled="busy" @click="emit('close')">先不保存，继续探索</button>
  </ModalShell>
</template>

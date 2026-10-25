<script setup lang="ts">
import SvgIcon from '../../../components/SvgIcon.vue'
import ModalShell from './ModalShell.vue'
import { editFields } from '../data'

defineOptions({ options: { styleIsolation: 'apply-shared' } })

defineProps<{
  busy: boolean
  error?: string
  stepOnly?: boolean
  latestStep?: string
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
  <ModalShell :title="stepOnly ? '留下一步，由你决定' : '这张卡片，由你确认'" :busy="busy" :error="error" @close="emit('close')">
    <text v-if="stepOnly" class="body-copy">写一句愿意尝试的事就好，也可以补充希望了解什么、愿意投入多少、什么时候停下</text>
    <view v-if="!stepOnly">
    <text class="muted small">这些内容只有保存后才会成为下次接续的依据，列表每行一项</text>
    <text class="field-label">当前问题</text>
    <input v-model="editor.title" class="text-field" maxlength="120"/>
    <view v-for="field in editFields" :key="field.key">
      <text class="field-label">{{ field.label }}</text>
      <textarea v-model="editor[field.key]" class="text-area compact" :placeholder="field.hint"
                maxlength="4800" :auto-height="true"/></view>
    </view>
    <text class="field-label">我愿意尝试的下一步</text>
    <textarea v-model="editor.next_step" class="text-area compact" maxlength="600"/>
    <text v-if="stepOnly" class="muted small">清空并保存会移除这一步，探索和已有记录仍然保留</text>
    <view v-if="stepOnly && latestStep !== editor.next_step" class="plan-version-compare"><text class="field-label">当前读取的已保存内容</text><text class="body-copy">{{ latestStep || '还没有下一步' }}</text></view>
    <button v-if="error" class="text-button" @click="emit('reload')" hover-class="pressed"
            :hover-start-time="0" :hover-stay-time="70">读取最新卡片版本，保留当前编辑
    </button>
    <button class="primary" :disabled="busy" :loading="busy" @click="emit('save')"
            hover-class="pressed" :hover-start-time="0" :hover-stay-time="70">确认这些内容并保存
      <SvgIcon name="check" light :size="19"/>
    </button>
  </ModalShell>
</template>

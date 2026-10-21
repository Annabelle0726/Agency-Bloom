<script setup lang="ts">
import ModalShell from './ModalShell.vue'
defineOptions({ options: { styleIsolation: 'apply-shared' } })
defineProps<{ text: string; busy: boolean; error: string; retained: boolean }>()
const emit = defineEmits<{ close: []; save: []; cancel: []; change: [text: string] }>()
function input(event: Event) { emit('change', (event as CustomEvent<{ value: string }>).detail.value) }
</script>

<template>
  <ModalShell title="修改消息" :busy="busy" :error="error" @close="emit('close')">
    <text class="page-description">重新回复成功后，将替换这条消息及其后的所有对话，并清除原会话总结。已确认的记忆和探索卡片会保留。</text>
    <text v-if="!retained" class="page-description">你已关闭聊天保存，修改仅保留在本次使用中。</text>
    <textarea class="text-area message-edit-input" :value="text" maxlength="2000" :disabled="busy" @input="input" />
    <button class="primary message-edit-save" :disabled="busy || !text.trim()" :loading="busy" @click="emit('save')">保存并重新回复</button>
    <button v-if="busy" class="text-button" @click="emit('cancel')">停止回复，保留修改草稿</button>
  </ModalShell>
</template>

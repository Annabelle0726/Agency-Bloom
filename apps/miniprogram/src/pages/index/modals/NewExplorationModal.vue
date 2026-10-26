<script setup lang="ts">
import ModalShell from './ModalShell.vue'
defineOptions({ options: { styleIsolation: 'apply-shared' } })
defineProps<{ draft: { title: string; background: string }; busy: boolean; error: string }>()
const emit = defineEmits<{ close: []; save: []; questions: [] }>()
</script>
<template>
  <ModalShell title="单独整理另一件事" :busy="busy" :error="error" @close="emit('close')">
    <text class="body-copy">例如把求职和关系分别推进。新问题会有自己的卡片与计划，原来的对话和记录仍保留</text>
    <text class="field-label">这件事想叫什么？</text>
    <input v-model="draft.title" class="text-field" maxlength="120" :disabled="busy" placeholder="比如：找一份适合现在的工作" />
    <text class="field-label">想先留下的一点背景（可选）</text>
    <textarea v-model="draft.background" class="text-area" maxlength="400" :auto-height="true" :disabled="busy" placeholder="只写这件事相关的情况，不必重新介绍全部的自己" />
    <button class="primary" data-exploration="save" :disabled="busy || !draft.title.trim()" :loading="busy" @click="emit('save')">建立独立问题，开始聊</button>
    <button class="text-button wide" :disabled="busy" @click="emit('questions')">也可以先用五问整理</button>
  </ModalShell>
</template>

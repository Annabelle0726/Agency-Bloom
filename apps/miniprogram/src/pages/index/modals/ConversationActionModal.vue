<script setup lang="ts">
import { onBeforeUnmount } from 'vue'
import ModalShell from './ModalShell.vue'
import { createConversationAction, type ConversationAction, type ConversationActionRequest } from '../../../conversation-action'
import type { Conversation } from '../../../domain'
defineOptions({ options: { styleIsolation: 'apply-shared' } })
const props = defineProps<{ action: ConversationAction; conversation: Conversation; request: ConversationActionRequest }>()
const emit = defineEmits<{ close: []; changed: [item: Conversation]; deleted: [id: string] }>()
let alive = true
onBeforeUnmount(() => { alive = false })
const { title, busy, error, save } = createConversationAction(props.action, props.conversation, props.request,
  item => { if (alive) emit('changed', item) }, id => { if (alive) emit('deleted', id) })
const labels = { rename: '重命名会话', archive: '归档会话', delete: '删除会话' }
async function submit() { if (await save() && alive) emit('close') }
function input(event: Event) { title.value = (event as CustomEvent<{ value: string }>).detail.value }
</script>

<template>
  <ModalShell :title="labels[action]" :busy="busy" :error="error" @close="emit('close')">
    <template v-if="action === 'rename'">
      <text class="page-description">给这段对话一个便于找到的名字</text>
      <input class="text-input conversation-rename-input" :value="title" :disabled="busy"
             maxlength="120" placeholder="会话名称" @input="input" @confirm="submit" />
    </template>
    <template v-else>
      <text class="conversation-action-name">{{ conversation.title }}</text>
      <text v-if="action === 'archive'" class="page-description">移入归档列表，之后可以恢复。所属探索会保留；未开启聊天保存时，原文仅在本次使用中可见</text>
      <text v-else class="page-description">删除这段会话、消息、总结和本机草稿，无法撤销。已确认的记忆、探索卡片和用量记录会保留</text>
    </template>
    <button class="primary conversation-action-submit" :disabled="busy || (action === 'rename' && !title.trim())"
            :loading="busy" @click="submit">{{ action === 'rename' ? '保存名称' : labels[action] }}</button>
    <button class="text-button conversation-action-cancel" :disabled="busy" @click="emit('close')">取消</button>
  </ModalShell>
</template>
<style scoped>
.conversation-action-name { display:block; font-size:16px; line-height:1.6; margin-bottom:12px; }
.conversation-action-submit { margin-top:20px; }
.conversation-action-cancel { width:100%; text-align:center; min-height:44px; }
</style>

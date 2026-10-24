<script setup lang="ts">
import { ref, watch } from 'vue'
import type { ChatMessage, Memory } from '../domain'
import type { MeRequest } from '../me-records'
defineOptions({ options: { styleIsolation: 'apply-shared' } })
const props = defineProps<{ item: Memory; userId: string; retainChat: boolean; request: MeRequest }>()
const open = ref(false), busy = ref(false), error = ref(''), messages = ref<ChatMessage[]>([]), cursor = ref<string | null>(null)
let generation = 0
watch(() => [props.userId, props.item.source_conversation_id, props.retainChat], () => { generation++; open.value = false; busy.value = false; messages.value = []; error.value = ''; cursor.value = null })
async function load(older = false) {
  if (busy.value || !props.item.source_conversation_id || !props.retainChat) return
  const attempt = ++generation, owner = props.userId
  busy.value = true; error.value = ''; open.value = true
  try {
    const page = await props.request<{ items: ChatMessage[]; next_cursor: string | null }>('GET', `/conversations/${encodeURIComponent(props.item.source_conversation_id)}/messages?limit=20` + (older && cursor.value ? '&before=' + encodeURIComponent(cursor.value) : ''))
    if (generation !== attempt || owner !== props.userId) return
    messages.value = older ? [...page.items, ...messages.value] : page.items; cursor.value = page.next_cursor
  } catch { if (generation === attempt && owner === props.userId) error.value = '来源暂不可读取，可能已被删除或网络不可用。已确认的记录仍保留' }
  finally { if (generation === attempt) busy.value = false }
}
</script>
<template>
  <view class="memory-source">
    <text v-if="!item.source_conversation_id" class="memory-source-note">未关联来源会话 · 这条内容由你独立确认</text>
    <text v-else-if="!retainChat" class="memory-source-note">聊天保存已关闭 · 来源原文不可用，独立记录仍保留</text>
    <template v-else>
      <button class="memory-source-toggle" :disabled="busy" :aria-expanded="open" @click="open ? open = false : load()">{{ open ? '收起来源会话' : '查看来源会话' }}</button>
      <view v-if="open" class="memory-source-content">
        <text class="memory-source-note">来源会话的可用原文，不代表整段对话都用于回复</text>
        <text v-if="busy" class="memory-source-note" role="status">正在读取…</text>
        <view v-if="error"><text class="memory-source-note" role="alert">{{ error }}</text><button class="memory-source-toggle" @click="load()">重试</button></view>
        <text v-else-if="!busy && !messages.length" class="memory-source-note">来源会话没有保留原文，已确认的记录仍可管理</text>
        <view v-for="message in messages" :key="message.id" class="memory-source-message"><text class="memory-source-note">{{ message.role === 'user' ? '你' : 'Bloom' }} · {{ message.created_at?.slice(0, 10) || '日期未记录' }}</text><text class="memory-source-text">{{ message.content }}</text></view>
        <button v-if="cursor" class="memory-source-toggle" :disabled="busy" @click="load(true)">查看更早原文</button>
      </view>
    </template>
  </view>
</template>
<style scoped lang="scss">
.memory-source { margin-top:8px; }
.memory-source-note { display:block; color:var(--muted); font-size:12px; line-height:1.8; }
.memory-source-toggle { min-height:44px; padding:5px 0; color:var(--accent); font-size:13px; line-height:1.8; background:transparent; }
.memory-source-content { padding:12px; border:1px solid var(--line); border-radius:8px; }
.memory-source-message { margin-top:12px; }
.memory-source-text { display:block; color:var(--ink); font-size:14px; line-height:1.8; white-space:pre-wrap; overflow-wrap:anywhere; }
</style>

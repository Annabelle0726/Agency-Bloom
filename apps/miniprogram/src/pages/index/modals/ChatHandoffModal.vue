<script setup lang="ts">
import ModalShell from './ModalShell.vue'
import type { HandoffPreview, HandoffChoice } from '../../../chat-handoff'
defineOptions({ options: { styleIsolation: 'apply-shared' } })
defineProps<{ preview: HandoffPreview; canAppend: boolean }>()
const emit = defineEmits<{ choose: [choice: HandoffChoice] }>()
</script>
<template>
  <ModalShell title="这段对话里已有草稿" :busy="false" @close="emit('choose', 'cancel')">
    <text class="body-copy">来自{{ preview.origin }} · 围绕「{{ preview.title }}」。选择怎样带入，之后仍由你修改并发送</text>
    <text class="field-label">原来的未发送内容</text>
    <scroll-view scroll-y class="handoff-preview"><text :selectable="true">{{ preview.current }}</text></scroll-view>
    <text class="field-label">这次准备带入的内容</text>
    <scroll-view scroll-y class="handoff-preview"><text :selectable="true">{{ preview.incoming }}</text></scroll-view>
    <button class="primary" data-handoff="new" @click="emit('choose', 'new')">另开一段聊，保留原草稿</button>
    <button class="secondary" data-handoff="append" :disabled="!canAppend" @click="emit('choose', 'append')">接在当前草稿后</button>
    <text v-if="!canAppend" class="muted small">合并后文字过长，可以另开一段，原文会保留</text>
    <button class="text-button wide" data-handoff="cancel" @click="emit('choose', 'cancel')">暂不带入</button>
  </ModalShell>
</template>
<style scoped>
.handoff-preview { max-height:150px; margin:8px 0 18px; padding:12px; box-sizing:border-box; border:1px solid var(--line); border-radius:8px; background:var(--soft); }
.handoff-preview text { display:block; white-space:pre-wrap; color:var(--ink); font-size:14px; line-height:1.75; }
.secondary { margin-top:12px; }
.small { display:block; margin-top:8px; }
</style>

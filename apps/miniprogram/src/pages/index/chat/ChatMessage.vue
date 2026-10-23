<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { responseReasoning, reasoningLabels } from '../../../response-reasoning'
import CompanionAvatar from '../../../components/CompanionAvatar.vue'
import SvgIcon from '../../../components/SvgIcon.vue'
import ChatVisual from './ChatVisual.vue'
import PerspectiveShiftEntry from './PerspectiveShiftEntry.vue'
import type { PerspectiveAction } from '../../../perspective-shift'
import type { PerspectiveShift } from '../../../domain'
import type { ChatMessage } from '../../../domain'
import type { BloomStatus } from '../../../bloom-status'
import SelectableReply from './SelectableReply.vue'
import ModalShell from '../modals/ModalShell.vue'

defineOptions({ options: { styleIsolation: 'apply-shared' } })

const props = defineProps<{
  message: ChatMessage
  index: number
  isLast: boolean
  speaking: boolean
  gazeActive?: boolean
  foreground?: boolean
  userAvatar: string
  editable: boolean
  themeId: string
  selectionOwner?: boolean
  perspective?: PerspectiveShift | null
  perspectiveBusy?: boolean
  bloomStatus?: BloomStatus
}>()
const emit = defineEmits<{ edit: []; ask: [text: string]; selection: [value: boolean]; perspective: [action: PerspectiveAction] }>()
const selecting = ref(false), actionsOpen = ref(false)
function copy() {
  uni.setClipboardData({ data: props.message.content, fail: () => uni.showToast({ title: '复制未完成，请重试', icon: 'none' }) })
  actionsOpen.value = false; selecting.value = false
}
function edit() { actionsOpen.value = false; emit('edit') }
function selectText() { actionsOpen.value = false; selecting.value = true }

const open = ref(false)
const explanations = computed(() => responseReasoning(props.message.payload?.reasoning_summary, props.message.content))
watch(() => [props.message.id, props.message.content, props.message.payload?.reasoning_summary], () => { open.value = false })
</script>

<template>
  <view :id="'message-' + index" class="message-row" :class="message.role">
    <CompanionAvatar :follow-gaze="gazeActive" :foreground="foreground" v-if="message.role === 'assistant'" :size="38" :status="isLast ? (bloomStatus || 'online') : 'online'"
                     :state="speaking ? 'speaking' : (isLast ? 'idle' : 'rest')" />
    <image v-else class="chat-avatar"
           :src="userAvatar || '/static/avatar-user.png'"
           mode="aspectFill" aria-label="你的头像"/>
    <view class="message-content">
      <text v-if="message.role === 'assistant'" class="message-name">Bloom</text>
      <SelectableReply v-if="message.role === 'assistant'" :content="message.content" :disabled="!editable" :selection-owner="selectionOwner" @ask="emit('ask',$event)" @active="emit('selection',$event)" />
      <text v-else class="message-bubble" @longpress.stop="actionsOpen = true">{{ message.content }}</text>
      <view v-if="message.role === 'assistant'" class="message-tools">
        <button class="message-copy" aria-label="复制这条回复" @click="copy" hover-class="pressed"><SvgIcon name="copy" tone="muted" :size="14" /><text>复制</text></button>
      </view>
      <ChatVisual v-if="message.role === 'assistant'" :visual-id="message.payload?.visual_id" :theme-id="themeId" />
      <view v-if="message.role === 'assistant' && explanations.length" class="response-reasoning">
        <button class="reasoning-toggle" :aria-expanded="open" aria-label="查看回应思路"
                @click="open = !open" hover-class="pressed" :hover-start-time="0" :hover-stay-time="70">
          <SvgIcon name="layers" tone="muted" :size="14"/>
          <text>{{ open ? '收起回应思路' : '查看回应思路' }}</text>
          <view class="reasoning-chevron" :class="{ 'is-open': open }"><SvgIcon name="chevron" tone="muted" :size="11"/></view>
        </button>
        <view v-if="open" class="reasoning-summary">
          <view v-for="point in explanations" :key="point.kind" class="reasoning-point">
            <text class="reasoning-label">{{ reasoningLabels[point.kind] }}</text>
            <text class="reasoning-text">{{ point.text }}</text>
          </view>
        </view>
      </view>
      <PerspectiveShiftEntry v-if="message.role === 'assistant' && perspective" :candidate="perspective"
        :busy="perspectiveBusy" @act="emit('perspective', $event)" />
      <view v-if="message.role === 'assistant' && message.payload?.web_sources?.length" class="web-sources">
        <text class="web-sources-label">根据网上资料（未经核实）</text>
        <view v-for="(source, sourceIndex) in message.payload.web_sources" :key="sourceIndex" class="web-source-row">
          <text class="web-source-site">{{ source.site || '来源' }}</text>
          <text class="web-source-name">{{ source.name || source.url }}</text>
        </view>
      </view>
    </view>
  </view>
  <ModalShell v-if="actionsOpen" title="消息操作" :busy="false" @close="actionsOpen = false">
    <button v-if="editable && message.role === 'user'" class="text-button message-action-edit" @click="edit">修改</button>
    <button class="text-button message-action-copy" @click="copy">复制</button>
    <button class="text-button message-action-select" @click="selectText">选择文字</button>
  </ModalShell>
  <ModalShell v-if="selecting" title="选择文字" :busy="false" @close="selecting = false">
    <text class="page-description">长按下方文字，拖动选区后复制</text>
    <scroll-view scroll-y class="selection-scroll">
      <text class="selectable-message" selectable user-select>{{ message.content }}</text>
    </scroll-view>
    <button class="text-button" @click="copy">复制全部</button>
  </ModalShell>
</template>

<style scoped>
.selection-scroll { max-height: 45vh; }
.selectable-message { display:block; white-space:pre-wrap; line-height:1.8; user-select:text; padding:12px 0; }
</style>

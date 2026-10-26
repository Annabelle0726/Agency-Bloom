<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, ref, watch } from 'vue'
import SvgIcon from '../../../components/SvgIcon.vue'
import ReplyMarkdown from './ReplyMarkdown.vue'
import {replyText} from '../../../reply-format'
import { messageUnits, nearestCharacter, selectedExcerpt, type CharacterRect } from '../../../message-selection'

defineOptions({ options: { styleIsolation: 'apply-shared' } })
const props = defineProps<{ content: string; disabled?: boolean; selectionOwner?: boolean }>()
const emit = defineEmits<{ ask: [text: string]; active: [value: boolean] }>()
const instance = getCurrentInstance()
const active = ref(false), start = ref(0), end = ref(0)
const units = computed(() => messageUnits(replyText(props.content)))
const excerpt = computed(() => selectedExcerpt(units.value, start.value, end.value))
const geometry = ref<CharacterRect[]>([]), origin = ref({left:0, top:0})
type SelectionEvent = { touches?: ArrayLike<{clientX: number; clientY: number}>; changedTouches?: ArrayLike<{clientX: number; clientY: number}>; detail?: unknown }
const point = (event: SelectionEvent) => {
  const detail = event.detail && typeof event.detail === 'object' ? event.detail as {x?: number; y?: number} : {}
  return event.touches?.[0] || event.changedTouches?.[0] || {clientX:detail.x ?? 0, clientY:detail.y ?? 0}
}
function measure(done: () => void) {
  const query = uni.createSelectorQuery().in(instance!.proxy)
  query.select('.selectable-reply').boundingClientRect(rect => { if (rect && !Array.isArray(rect)) origin.value = {left:rect.left ?? 0,top:rect.top ?? 0} })
  query.selectAll('.selection-char').boundingClientRect(rects => { if (Array.isArray(rects)) geometry.value = rects as CharacterRect[]; done() }).exec()
}
async function begin(event: SelectionEvent) {
  if (props.disabled) return
  const touch = point(event)
  uni.hideKeyboard(); active.value = true; emit('active', true)
  await nextTick()
  measure(() => { const index = nearestCharacter(geometry.value, touch.clientX, touch.clientY); start.value=index; end.value=index+1 })
}
function drag(edge: 'start' | 'end', event: SelectionEvent) {
  const touch = point(event)
  measure(() => {
    const index = nearestCharacter(geometry.value, touch.clientX, touch.clientY)
    if (edge === 'start') start.value = Math.min(index, end.value - 1)
    else end.value = Math.max(index + 1, start.value + 1)
  })
}
function close() { active.value=false; emit('active',false) }
function copy() { if (excerpt.value) uni.setClipboardData({data:excerpt.value}); close() }
function ask() { if (excerpt.value.trim()) { emit('ask',excerpt.value); close() } }
const first = computed(() => geometry.value[start.value])
const last = computed(() => geometry.value[end.value-1])
const toolbar = computed(() => {
  const screen = uni.getSystemInfoSync()
  return {left:`${Math.max(12,Math.min(origin.value.left,screen.windowWidth-220))}px`,top:`${Math.max(84,Math.min((first.value?.top ?? 140)-46,screen.windowHeight-210))}px`}
})
const handle = (edge: 'start'|'end') => {
  const rect = edge === 'start' ? first.value : last.value
  return {left:`${((edge === 'start' ? rect?.left : rect?.right) ?? 0) - origin.value.left}px`,top:`${(rect?.bottom ?? 0)-origin.value.top}px`}
}
watch(() => props.content, close)
watch(() => props.selectionOwner, value => { if (value === false && active.value) close() })
watch(() => props.disabled, value => { if (value && active.value) close() })
</script>

<template>
  <view class="selectable-reply">
    <view v-if="!active" class="message-bubble" @longpress.stop="begin"><ReplyMarkdown :content="content" /></view>
    <view v-else class="selection-surface">
      <text class="message-bubble selection-body"><text v-for="(char,index) in units" :key="index" class="selection-char" :class="{chosen:index>=start && index<end}">{{ char }}</text></text>
      <view class="selection-toolbar" :style="toolbar" @touchstart.stop @touchmove.stop>
        <button class="selection-copy" @click.stop="copy" hover-class="pressed">复制</button>
        <button class="selection-ask" :disabled="!excerpt.trim()" @click.stop="ask" hover-class="pressed"><SvgIcon name="chat" :size="14"/><text>聊聊这段</text></button>
        <button class="selection-close" aria-label="取消选择" @click.stop="close" hover-class="pressed"><SvgIcon name="close" :size="13"/></button>
      </view>
      <view class="selection-handle start" :style="handle('start')" @touchstart.stop.prevent @touchmove.stop.prevent="drag('start',$event)" aria-label="拖动选择起点" />
      <view class="selection-handle end" :style="handle('end')" @touchstart.stop.prevent @touchmove.stop.prevent="drag('end',$event)" aria-label="拖动选择终点" />
    </view>
  </view>
</template>

<style scoped>
.selectable-reply { position:relative; }
.selection-body { white-space:pre-wrap; }
.selection-char { display:inline; }
.chosen { background:var(--selection); color:var(--ink); }
.selection-toolbar { position:fixed; z-index:25; display:flex; align-items:center; gap:2px; padding:3px; border:1px solid var(--line); border-radius:10px; background:var(--paper); box-shadow:0 4px 16px var(--soft); }
.selection-toolbar button { display:flex; align-items:center; justify-content:center; gap:5px; min-height:36px; margin:0; padding:7px 10px; background:transparent; color:var(--ink); font-size:12px; line-height:1.2; }
.selection-toolbar button::after { border:0; }
.selection-handle { position:absolute; z-index:26; width:40px; height:40px; transform:translate(-50%,-12px); touch-action:none; }
.selection-handle::after { content:''; position:absolute; left:16px; top:10px; width:9px; height:9px; border-radius:50%; background:var(--accent); }
.selection-handle::before { content:''; position:absolute; left:20px; top:-6px; width:1px; height:19px; background:var(--accent); }
</style>

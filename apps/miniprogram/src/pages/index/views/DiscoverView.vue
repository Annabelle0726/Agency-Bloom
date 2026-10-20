<script setup lang="ts">
import SvgIcon from '../../../components/SvgIcon.vue'
import { discoveryPrompts } from '../data'

defineOptions({ options: { styleIsolation: 'apply-shared' } })

defineProps<{ hasCurrent: boolean }>()
const emit = defineEmits<{
  explore: [question: string]
  history: []
}>()
</script>

<template>
  <view class="workspace discover-content">
    <view class="section-intro"><text class="eyebrow">A DIFFERENT PERSPECTIVE</text><text class="page-title">换个角度，看看生活</text><text class="page-description">有些答案，会从一个新的问题开始</text></view>
    <button v-for="(prompt, index) in discoveryPrompts" :key="prompt.title" class="discovery-card glass-card" :data-discovery="index" @click="emit('explore', prompt.question)" hover-class="pressed" :hover-start-time="0">
      <view class="discovery-heading"><view class="focus-symbol"><SvgIcon :name="prompt.icon" :size="22" /></view><text>{{ prompt.label }}</text><SvgIcon name="arrow-diagonal" :size="18" /></view>
      <text class="discovery-title">{{ prompt.title }}</text><text class="discovery-question">{{ prompt.question }}</text><text class="discovery-hint">{{ hasCurrent ? '带着这个问题聊聊' : '先留下线索，再慢慢聊' }}</text>
    </button>
    <button class="history-entry glass-card" @click="emit('history')" hover-class="pressed"><SvgIcon name="note" :size="21" /><view><text>回看走过的路</text><text>看看哪些想法，正在慢慢改变</text></view><SvgIcon name="chevron" :size="18" /></button>
  </view>
</template>

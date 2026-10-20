<script setup lang="ts">
import SvgIcon from '../../../components/SvgIcon.vue'
import type { Suggestion } from '../../../domain'

defineOptions({ options: { styleIsolation: 'apply-shared' } })

defineProps<{ suggestion: Suggestion }>()
const emit = defineEmits<{ review: [] }>()
</script>

<template>
  <view class="proposal-card">
    <text class="eyebrow">一个待你确认的想法</text>
    <text class="body-copy">{{ suggestion.next_step }}</text>
    <button class="text-button" @click="emit('review')" hover-class="pressed" :hover-start-time="0"
            :hover-stay-time="70">查看草稿，确认后加入卡片
      <SvgIcon name="arrow-diagonal" :size="17"/>
    </button>
  </view>
</template>

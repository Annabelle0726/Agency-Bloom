<script setup lang="ts">
import SvgIcon from '../../../components/SvgIcon.vue'
import type { Insight } from '../../../domain'

defineOptions({ options: { styleIsolation: 'apply-shared' } })

defineProps<{
  insight: Insight
  sending: boolean
  busy: boolean
  reaction: string
}>()
const emit = defineEmits<{ react: [action: 'interested' | 'dismissed' | 'experiment'] }>()
</script>

<template>
  <view class="insight-card">
    <view class="insight-heading"><SvgIcon name="spark" :size="20" /><text>还有一种可能</text></view>
    <text class="insight-observation">{{ insight.observation }}</text>
    <text class="insight-possibility">{{ insight.possibility }}</text>
    <text class="insight-uncertainty">{{ insight.uncertainty }}</text>
    <view class="insight-actions"><button data-insight="interested" :disabled="sending || busy || reaction === 'interested'" @click="emit('react', 'interested')" hover-class="pressed" :hover-start-time="0" :hover-stay-time="70">{{ reaction === 'interested' ? '已带入下一次探索' : '这个角度有意思' }}</button><button data-insight="dismissed" :disabled="sending || busy" @click="emit('react', 'dismissed')" hover-class="pressed" :hover-start-time="0" :hover-stay-time="70">不太像我</button><button data-insight="experiment" :disabled="sending || busy" @click="emit('react', 'experiment')" hover-class="pressed" :hover-start-time="0" :hover-stay-time="70">让我试一下 <SvgIcon name="arrow-diagonal" :size="15" /></button></view>
    <text v-if="reaction" class="insight-footnote">这只是待探索的角度，尚未写入你的卡片</text>
  </view>
</template>

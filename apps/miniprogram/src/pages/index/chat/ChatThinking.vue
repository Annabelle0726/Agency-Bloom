<script setup lang="ts">
import CompanionAvatar from '../../../components/CompanionAvatar.vue'

defineOptions({ options: { styleIsolation: 'apply-shared' } })

defineProps<{ generatingSummary: boolean }>()
</script>

<template>
  <view class="thinking">
    <CompanionAvatar :size="38" state="thinking" :interactive="false"/>
    <view class="thinking-copy">
      <text class="message-name">Bloom</text>
      <text>{{ generatingSummary ? '正在整理会话，随时可以停止' : '正在回应，随时可以停止' }}</text>
    </view>
  </view>
</template>

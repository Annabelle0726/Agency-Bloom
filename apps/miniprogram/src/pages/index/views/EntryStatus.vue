<script setup lang="ts">
import ActionButton from '../../../components/ActionButton.vue'

defineOptions({ options: { styleIsolation: 'apply-shared' } })

defineProps<{
  offline: boolean
  error: string
  busy: boolean
  initBusy: boolean
  initError: string
}>()
const emit = defineEmits<{ retry: []; logout: [] }>()
</script>

<template>
  <view class="entry-status">
    <text class="eyebrow">AGENCY BLOOM</text>
    <text class="page-title">{{ offline || error ? '连接暂时停了一下' : '正在回到你的空间' }}</text>
    <text class="body-copy">{{ initError || error || '稍等片刻，我们正在恢复上次的进展。' }}</text>
    <ActionButton v-if="offline || error" :loading="busy || initBusy" @click="emit('retry')">重新连接</ActionButton>
    <button v-if="offline || error" class="text-button" :disabled="busy" @click="emit('logout')">返回登录</button>
  </view>
</template>

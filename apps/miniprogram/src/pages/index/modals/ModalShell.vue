<script setup lang="ts">
import SvgIcon from '../../../components/SvgIcon.vue'

defineOptions({ options: { styleIsolation: 'apply-shared' } })

defineProps<{
  title: string
  busy: boolean
  error?: string
  appearance?: boolean
}>()
const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <view class="modal-backdrop" @click.self="!busy && emit('close')">
    <view class="modal-sheet" :class="{ 'appearance-sheet': appearance }" @click.stop>
      <view class="modal-handle"/>
      <view class="modal-heading">
        <text class="section-title">{{ title }}</text>
        <button class="icon-button" :disabled="busy" aria-label="关闭面板" @click="emit('close')" hover-class="pressed"
                :hover-start-time="0" :hover-stay-time="70">
          <SvgIcon name="close" :size="20"/>
        </button>
      </view>
      <scroll-view scroll-y class="modal-scroll" :class="{ 'appearance-scroll': appearance }">
        <view v-if="error" class="notice error-notice">{{ error }}</view>
        <slot/>
      </scroll-view>
      <slot name="footer"/>
    </view>
  </view>
</template>

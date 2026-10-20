<script setup lang="ts">
defineOptions({ options: { styleIsolation: 'apply-shared' } })

defineProps<{
  pendingText: string
  userAvatar: string
}>()
</script>

<template>
  <view class="message-row user">
    <image class="chat-avatar" :src="userAvatar || '/static/avatar-user.png'" mode="aspectFill"
           aria-label="你的头像"/>
    <view class="message-content">
      <text class="message-bubble">{{ pendingText }}</text>
    </view>
  </view>
</template>

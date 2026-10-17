<script setup lang="ts">
import ActionButton from './ActionButton.vue'
defineEmits<{ enter: [] }>()
</script>

<template>
  <view class="first-arrival">
    <image class="arrival-background" src="/static/morning-light.jpg" mode="aspectFill" />
    <view class="arrival-header"><text>AGENCY OS</text><button class="arrival-skip" hover-class="pressed" @click="$emit('enter')">直接进入</button></view>
    <scroll-view class="arrival-scroll" scroll-y :show-scrollbar="false">
      <view class="arrival-letter">
        <text class="arrival-eyebrow">在开始之前，想对你说</text>
        <text class="arrival-title">{{ '我还想\n按自己的意愿活一活' }}</text>
        <text class="arrival-origin">Agency OS 从这个朴素的愿望出发</text>
        <view class="arrival-rule" />
        <text class="arrival-paragraph">{{ '现实会划出边界\n但在尚有余地的地方\n我们仍可以辨认自己的意愿，争取选择' }}</text>
        <text class="arrival-paragraph">{{ '这里可以陪你理清工作与方向中的困惑\n比较选择，尝试一点改变\n也给休息、犹豫和重新选择留下位置' }}</text>
        <text class="arrival-paragraph">{{ '你不必先成为理想中的自己\n才开始拥有自己的生活' }}</text>
        <text class="arrival-wish">{{ '愿每一次向前\n都更靠近你愿意亲自度过的生活' }}</text>
      </view>
    </scroll-view>
    <view class="arrival-footer"><text class="arrival-saved">这次探索已保存，接下来按你的节奏</text><ActionButton @click="$emit('enter')">进入我的空间</ActionButton></view>
  </view>
</template>

<style scoped>
.first-arrival { position:relative; display:flex; flex-direction:column; height:var(--app-height,100vh); min-height:480px; overflow:hidden; color:#29374b; background:#f7f6f3; }
.arrival-background { position:absolute; top:0; left:0; width:100%; height:100%; opacity:.26; pointer-events:none; }
.arrival-header { position:relative; flex-shrink:0; padding:calc(var(--capsule-bottom,64px) + 12px) 30px 6px; display:flex; align-items:center; justify-content:space-between; font-size:11px; letter-spacing:2.4px; }
.first-arrival .arrival-skip { padding:12px 0 12px 12px; min-height:44px; margin:0; background:transparent; color:#667180; font-size:12px; line-height:1.7; letter-spacing:0; }
.arrival-scroll { position:relative; flex:1; height:0; min-height:0; }
.arrival-letter { padding:25px 30px 32px; }
.arrival-eyebrow { display:block; font-size:11px; letter-spacing:1.5px; color:#667180; }
.arrival-title { display:block; margin-top:18px; font-family:var(--font-heading); font-size:30px; line-height:1.65; white-space:pre-line; }
.arrival-origin { display:block; margin-top:14px; font-size:12px; line-height:1.9; color:#667180; }
.arrival-rule { width:30px; height:1px; background:#80927c; margin:24px 0; }
.arrival-paragraph { display:block; white-space:pre-line; font-size:14px; line-height:2; margin:0 0 22px; }
.arrival-wish { display:block; white-space:pre-line; font-family:var(--font-heading); font-size:18px; line-height:1.9; margin-top:25px; color:#425e4c; }
.arrival-footer { position:relative; flex-shrink:0; padding:14px 30px calc(18px + env(safe-area-inset-bottom)); background:#f7f6f3ed; border-top:1px solid #e5e7e0; }
.arrival-saved { display:block; font-size:11px; color:#667180; text-align:center; margin-bottom:12px; line-height:1.8; }
@media(max-width:360px) { .arrival-header,.arrival-letter,.arrival-footer { padding-left:24px; padding-right:24px; } .arrival-title { font-size:27px; } .arrival-paragraph { font-size:13px; } }
</style>

<script setup lang="ts">
import {computed} from 'vue'
import {formatReply} from '../../../reply-format'
defineOptions({options:{styleIsolation:'apply-shared'}})
const props=defineProps<{content:string}>()
const blocks=computed(()=>formatReply(props.content))
</script>
<template>
  <view class="reply-markdown">
    <view v-for="(block,index) in blocks" :key="index" class="reply-block" :class="'reply-'+block.kind">
      <text v-if="block.prefix" class="reply-list-marker">{{block.prefix}}</text><text class="reply-line"><text v-for="(run,n) in block.runs" :key="n" class="reply-run" :class="{'reply-bold':run.bold,'reply-italic':run.italic,'reply-highlight':run.highlight,'reply-inline-code':run.code}">{{run.text}}</text></text>
    </view>
  </view>
</template>
<style scoped>
.reply-markdown {width:100%;color:var(--ink);font-size:inherit;line-height:inherit;overflow-wrap:anywhere}
.reply-block {display:block;white-space:pre-wrap;margin-top:12px}.reply-block:first-child{margin-top:0}
.reply-bold {font-weight:650;color:var(--action-text,var(--accent))}.reply-italic{font-style:italic}
.reply-highlight{color:var(--action-text,var(--accent));background:var(--soft);font-weight:600;border-radius:3px;padding:0 2px}
.reply-heading{font-size:1.08em;font-weight:650;margin-top:18px}.reply-list{display:flex;gap:3px;margin-top:5px}.reply-list-marker{flex:0 0 auto}.reply-line{min-width:0}
.reply-quote{border-left:2px solid var(--line);padding-left:12px;color:var(--muted)}
.reply-inline-code{font-family:monospace;background:var(--soft);border-radius:3px;padding:0 2px}
.reply-code{padding:10px 12px;border:1px solid var(--line);border-radius:8px;background:var(--paper);overflow-x:auto;font-family:monospace}
.reply-code .reply-inline-code{padding:0;background:transparent}
</style>

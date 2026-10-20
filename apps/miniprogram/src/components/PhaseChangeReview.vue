<script setup lang="ts">
import { ref } from 'vue'
import type { PhaseChange } from '../domain'
defineOptions({ options: { styleIsolation: 'apply-shared' } })
const props = defineProps<{ change: PhaseChange; confirmed: boolean; busy: boolean; error?: string }>()
const emit = defineEmits<{ confirm: []; skip: []; close: []; save: [content: string, keepHistory: boolean] }>()
const content = ref(props.change.evidence), keepHistory = ref(false)
</script>

<template>
  <view class="workspace-backdrop" @click.self="!busy && emit('close')">
    <view class="workspace-drawer" role="dialog" aria-label="核实当前方向" @click.stop>
      <view class="drawer-heading"><text class="section-title">{{ confirmed ? '审阅更新建议' : '核实当前方向' }}</text><button class="text-button" :disabled="busy" @click="emit('close')">关闭</button></view>
      <view class="drawer-body">
      <scroll-view scroll-y :show-scrollbar="false" class="drawer-scroll">
        <view class="drawer-scroll-content">
          <text class="field-label">{{ change.source_kind === 'snapshot' ? '初始快照中的方向' : '之前确认的记录' }}</text>
          <text class="body-copy">{{ change.previous }}</text>
          <text class="field-label">你这次的表达</text><text class="body-copy">{{ change.evidence }}</text>
          <template v-if="!confirmed">
            <text class="body-copy">这代表你当前方向有变化吗？也可以只是这次想聊的内容</text>
            <button class="primary confirm-phase-change" :disabled="busy" @click="emit('confirm')">是，查看更新建议</button>
            <button class="text-button skip-phase-change" :disabled="busy" @click="emit('skip')">暂时跳过，不更新</button>
          </template>
          <template v-else>
            <text class="field-label">准备保存的内容 · 可修改</text>
            <textarea v-model="content" class="text-area phase-content" :maxlength="400" />
            <text class="muted small">保存前不会改变任何记录，保存后也可在「我的」中修改、停用或删除</text>
            <button class="setting-row" :aria-pressed="keepHistory" :disabled="busy" @click="keepHistory = !keepHistory"><text>保留旧记录作为历史</text><view class="toggle" :class="{ on: keepHistory }"><view /></view></button>
            <text class="muted small">{{ keepHistory ? '历史不会作为当前有效目标使用' : change.source_kind === 'snapshot' ? '保存时删除这份初始资料，独立保存的卡片和聊天仍保留' : '保存时删除被替换的旧记录' }}</text>
            <text v-if="error" class="notice">{{ error }}</text>
            <button class="primary save-phase-change" :disabled="busy || !content.trim()" @click="emit('save', content.trim(), keepHistory)">确认并保存</button>
            <button class="text-button" :disabled="busy" @click="emit('skip')">暂不保存</button>
          </template>
        </view>
      </scroll-view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import SvgIcon from '../../../components/SvgIcon.vue'
import ModalShell from './ModalShell.vue'

defineOptions({ options: { styleIsolation: 'apply-shared' } })

defineProps<{
  aiMode: string
  busy: boolean
  error?: string
}>()
const emit = defineEmits<{ close: []; consent: [] }>()
</script>

<template>
  <ModalShell title="开始之前，先告诉你" :busy="busy" :error="error" @close="emit('close')">
    <text class="body-copy">{{
        aiMode === 'demo' ? '当前为本地演示，回复来自固定示例，不会向 DeepSeek 发送内容，启用真实 AI 后，下述处理说明适用' : '为了回应你，我们会将当前探索卡片、背景与反馈、本次输入、有限的当前会话、已审阅总结、你明确关联的探索卡片，以及已启用且范围匹配的长期记忆发送给 DeepSeek 处理。整理总结由你点击触发，也使用对话额度'
      }}
    </text>
    <text class="body-copy">AI
      的建议可能有误，尚未核实的内容会作为推测或待核实项，它不会替你做决定，也不会自动改写你的卡片
    </text>
    <text class="body-copy">聊天默认保存到你的账号，可随时在「我的」关闭并清除；这与第三方模型服务的数据处理政策是不同的</text>
    <template #footer>
      <view class="ai-consent-actions">
        <button class="primary ai-consent-submit" :disabled="busy" :loading="busy" @click.stop="emit('consent')"
                hover-class="pressed" :hover-start-time="0" :hover-stay-time="70">
          {{ busy ? '正在保存同意设置' : '同意并开始聊聊' }}
          <SvgIcon v-if="!busy" name="arrow" light :size="20"/>
        </button>
        <button class="text-button wide ai-consent-dismiss" :disabled="busy" @click.stop="emit('close')"
                hover-class="pressed" :hover-start-time="0" :hover-stay-time="70">暂时不用 AI，先整理卡片</button>
      </view>
    </template>
  </ModalShell>
</template>

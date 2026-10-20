<script setup lang="ts">
import ModalShell from './ModalShell.vue'

defineOptions({ options: { styleIsolation: 'apply-shared' } })

defineProps<{ busy: boolean; error?: string }>()
const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <ModalShell title="用户协议与隐私政策" :busy="busy" :error="error" @close="emit('close')">
    <text class="eyebrow">你的选择，始终重要</text>
    <text class="field-label">使用约定</text>
    <text class="body-copy">本 Alpha
      面向成年人，你保留自己的决定权，可以停止使用、修改记录或删除账号，请只提供有权分享的信息；关键行动和事实由你核实，正式发布前会补齐运营主体与联系渠道
    </text>
    <text class="field-label">回答问题时</text>
    <text class="body-copy">引导草稿保存在当前设备，可在 7
      天内接续；下次打开时会清除过期草稿，点击「保存这次探索」前不上传回答，你可以在引导页随时清除本机草稿；不要在共用设备上填写敏感信息
    </text>
    <text class="field-label">登录和保存</text>
    <text class="body-copy">
      保存探索、会话名称、你确认的决策卡和反馈。完整聊天默认保存，关闭会立即清除聊天与总结，可随时重新开启（只影响之后的对话）。长期记忆只有明确确认后才保存，使用开关独立，支持编辑、停用、合并和删除；删除记忆不改写历史聊天原文
    </text>
    <text class="field-label">AI 与数据服务</text>
    <text class="body-copy">AI 对话在你单独同意后调用 DeepSeek，部署版本使用 Supabase 托管
      PostgreSQL，可能在境外区域；正式内测前需确定实际部署区域并更新说明，当前本地演示使用本机 SQLite，固定示例回复不调用模型
    </text>
    <text class="field-label">关于建议</text>
    <text class="body-copy">
      这里提供理解处境、澄清选择和探索下一步的支持，不提供心理诊断或治疗，模型生成的内容可能不准确，关键事实需要核实，下一步由你决定
    </text>
    <text class="field-label">记录删除与运行日志</text>
    <text class="body-copy">
      应用不在运行日志中记录聊天正文或密钥，删除账号后，保留不含对话内容、已解除账号关联的费用统计，第三方服务的留存规则以其实际政策为准
    </text>
    <text class="muted small">{{ '内测说明 · 2026-10-16\n正式公开发布前需补齐运营主体和联系方式' }}</text>
  </ModalShell>
</template>

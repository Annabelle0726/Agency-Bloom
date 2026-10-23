<script setup lang="ts">
import { inject } from 'vue'
import { SPEECH_KEY } from '../../../speech'
import ModalShell from './ModalShell.vue'
defineOptions({ options: { styleIsolation: 'apply-shared' } })
const speech=inject(SPEECH_KEY)!
</script>
<template>
  <ModalShell v-if="speech.consentOpen.value && !speech.activeKey.value" title="朗读与语音隐私" :busy="speech.consentBusy.value" :error="speech.consentError.value" @close="speech.stop()">
    <text class="body-copy">{{ speech.mode.value==='mock'?'当前为 Mock 试听，播放本地生成的提示音，不会向腾讯云发送文字，也不代表真实音色效果':'朗读使用腾讯云语音合成，需要把你点击的这条 AI 最终回复发送给腾讯云处理' }}</text>
    <text class="body-copy">启用真实语音后，只发送所选回复的正文，不发送原始思考内容、系统指令或其他消息。腾讯云按其服务协议与隐私政策处理数据，第三方留存规则与本应用的聊天保存设置不同</text>
    <text class="body-copy">音频在服务端私密缓存 {{ Math.round((speech.settings.value?.cache_seconds || 3600)/60) }} 分钟以便重复播放，到期删除；设备临时音频在停止、切换会话或离开页面时清理。不会自动朗读新消息</text>
    <text class="body-copy">可以在「我的 → 朗读与语音隐私」撤回授权并删除缓存</text>
    <template #footer>
      <view class="speech-consent-actions">
        <button v-if="!speech.settings.value?.consented" class="primary speech-consent-accept" :disabled="speech.consentBusy.value" :loading="speech.consentBusy.value" @click.stop="speech.accept()">{{ speech.activeKey.value?'同意并播放这条回复':'同意启用按需朗读' }}</button>
        <button v-else class="text-button wide speech-consent-revoke" :disabled="speech.consentBusy.value" @click.stop="speech.revoke()">撤回授权并删除音频缓存</button>
        <button class="text-button wide" :disabled="speech.consentBusy.value" @click.stop="speech.stop()">{{ speech.settings.value?.consented?'关闭':'暂时不用' }}</button>
      </view>
    </template>
  </ModalShell>
</template>
<style scoped>.speech-consent-actions{padding:12px 24px calc(16px + env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:8px}</style>

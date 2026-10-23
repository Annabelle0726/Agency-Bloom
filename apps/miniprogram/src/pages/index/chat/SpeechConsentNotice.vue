<script setup lang="ts">
import { inject, ref, watch } from 'vue'
import SvgIcon from '../../../components/SvgIcon.vue'
import { SPEECH_KEY } from '../../../speech'
defineOptions({ options: { styleIsolation: 'apply-shared' } })
const speech=inject(SPEECH_KEY)!
const details=ref(false)
watch(speech.consentOpen,()=>{details.value=false})
</script>
<template>
  <view v-if="speech.consentOpen.value && speech.activeKey.value" class="speech-consent-notice" role="region" aria-label="首次朗读说明">
    <view class="speech-notice-heading"><SvgIcon name="volume" :size="15" tone="muted"/><text>{{ speech.mode.value==='mock'?'试听本地提示音，不向第三方发送文字':'朗读会将这条回复正文交给腾讯云合成语音' }}</text></view>
    <text v-if="details" class="speech-notice-details">只处理你点击的最终回复，不发送原始思考或系统指令。腾讯云按其服务协议与隐私政策处理数据；音频在服务端缓存 {{ Math.round((speech.settings.value?.cache_seconds || 3600)/60) }} 分钟后清理，可在「我的 → 朗读与语音隐私」撤回授权。不会自动朗读新消息</text>
    <text v-if="speech.consentError.value" class="speech-notice-error" role="alert">{{ speech.consentError.value }}</text>
    <view class="speech-notice-actions">
      <button class="speech-notice-accept" :disabled="speech.consentBusy.value" :loading="speech.consentBusy.value" @click="speech.accept()" hover-class="pressed">{{ speech.consentBusy.value?'正在启用':'启用并朗读' }}</button>
      <button class="speech-notice-skip" :disabled="speech.consentBusy.value" @click="speech.stop()" hover-class="pressed">先不听</button>
      <button class="speech-notice-more" :aria-expanded="details" @click="details=!details" hover-class="pressed">{{ details?'收起说明':'了解说明' }}</button>
    </view>
  </view>
</template>
<style scoped>
.speech-consent-notice{max-width:448px;margin:0 auto 8px;padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:var(--paper);color:var(--ink);box-sizing:border-box}
.speech-notice-heading{display:flex;align-items:flex-start;gap:7px;font-size:12px;line-height:1.7}.speech-notice-heading text{flex:1;min-width:0}
.speech-notice-details,.speech-notice-error{display:block;font-size:11px;line-height:1.8;margin-top:8px;color:var(--muted)}.speech-notice-error{color:var(--ink)}
.speech-notice-actions{display:flex;align-items:center;gap:12px;margin-top:5px;flex-wrap:wrap}.speech-notice-actions button{margin:0;padding:5px 0;min-height:32px;line-height:22px;font-size:12px;background:transparent;color:var(--muted)}.speech-notice-actions button::after{border:0}.speech-notice-actions .speech-notice-accept{color:var(--accent);font-weight:500}.speech-notice-actions .speech-notice-more{margin-left:auto;font-size:11px}
</style>

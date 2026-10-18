<script setup lang="ts">
import { ref } from 'vue'
import ActionButton from './ActionButton.vue'
import SvgIcon from './SvgIcon.vue'
defineProps<{ busy: boolean; error: string; devAuth: boolean; ready: boolean; offline: boolean; connecting: boolean; wechatAuth?: boolean; hasDemo: boolean }>()
const emit = defineEmits<{ login: [mode: 'wechat' | 'demo-new' | 'demo-resume']; replay: []; privacy: []; retry: [] }>()
const accepted = ref(false)
function login(mode: 'wechat' | 'demo-new' | 'demo-resume') { if (accepted.value) emit('login', mode) }
</script>

<template>
  <view class="auth-welcome">
    <image class="auth-background" src="/static/morning-light.jpg" mode="aspectFill" aria-hidden="true" />
    <view class="auth-shade" />
    <scroll-view class="auth-scroll" scroll-y :show-scrollbar="false">
      <view class="auth-content">
        <view class="auth-top"><text>AGENCY OS</text><button :disabled="busy" @click="emit('replay')" hover-class="pressed">重看开场</button></view>
        <view class="auth-heading"><text class="auth-eyebrow">A LITTLE SPACE FOR YOURSELF</text><text class="auth-title">给自己一点空间</text><text class="auth-subtitle">{{ '让每一次向前\n都更靠近你愿意亲自度过的生活' }}</text></view>
        <view class="auth-letter"><text>不必先想清楚一切。</text><text>带着困惑，或一点好奇来就好。</text><text>我们可以从一件小事，慢慢聊起。</text></view>
        <view class="auth-actions">
          <text v-if="error" class="notice">{{ error }}</text>
          <view v-if="offline || connecting" class="auth-connection"><text>{{ connecting ? '正在连接服务…' : '暂时无法连接服务，请稍后重试' }}</text><button :disabled="connecting || busy" @click="emit('retry')">重试</button></view>
          <view class="auth-consent">
            <button class="auth-check" :aria-pressed="accepted" aria-label="同意用户协议与隐私政策" :disabled="busy" @click="accepted = !accepted"><view :class="{ checked: accepted }"><SvgIcon v-if="accepted" name="check" light :size="12" /></view></button>
            <view><text>我已阅读并同意</text><button class="auth-policy" @click="emit('privacy')">《用户协议》与《隐私政策》</button></view>
          </view>
          <!-- #ifdef MP-WEIXIN -->
          <ActionButton kind="wechat" :disabled="!accepted || wechatAuth === false || connecting" :loading="busy" @click="login('wechat')">微信登录 / 注册</ActionButton>
          <text v-if="wechatAuth === false && ready" class="auth-note">微信登录尚未配置，请稍后再来</text>
          <!-- #endif -->
          <ActionButton v-if="devAuth" kind="secondary" :disabled="!accepted || connecting" :loading="busy" @click="login(hasDemo ? 'demo-resume' : 'demo-new')">{{ hasDemo ? '继续本机演示' : '创建演示账号' }}</ActionButton>
          <text v-if="devAuth" class="auth-note">{{ hasDemo ? '登录之前的演示账号，恢复已有记录' : '首次创建后，本机可在 30 天内重新登录' }}</text>
          <button v-if="devAuth && hasDemo" class="auth-new-demo" :disabled="!accepted || busy || connecting" @click="login('demo-new')">创建新的演示账号</button>
          <text v-if="devAuth" class="auth-note">演示账号与微信账号独立 · 不跨设备同步</text>
          <!-- #ifdef H5 -->
          <text v-if="!devAuth && ready" class="auth-note">请在微信小程序中登录，继续你的探索</text>
          <!-- #endif -->
          <text v-if="wechatAuth !== false" class="auth-note">首次微信登录将创建账号；回来时，接着上次的进展。</text>
          <text class="auth-note">登录后点选几项即可开始，也可以稍后再答。</text>
        </view>
        <text class="auth-signature">YOUR LIFE, YOUR WAY</text>
      </view>
    </scroll-view>
  </view>
</template>

<style scoped>
.auth-welcome { height:var(--app-height,100vh); position:relative; overflow:hidden; background:#f2eee5; color:#344139; }
.auth-background,.auth-shade { position:absolute; inset:0; width:100%; height:100%; }
.auth-shade { background:linear-gradient(180deg,rgba(250,248,242,.52),rgba(250,248,242,.75) 45%,rgba(250,248,242,.95)); }
.auth-scroll { height:100%; position:relative; }
.auth-content { min-height:var(--app-height,100vh); padding:calc(var(--capsule-bottom,64px) + 16px) 30px calc(24px + env(safe-area-inset-bottom)); box-sizing:border-box; display:flex; flex-direction:column; }
.auth-top { display:flex; align-items:center; justify-content:space-between; font-size:12px; letter-spacing:3px; }
.auth-top button { padding:12px 0 12px 16px; margin:0; font-size:12px; line-height:1.6; color:#586657; background:transparent; letter-spacing:0; }
button::after { border:0; }
.auth-heading { margin-top:24px; }
.auth-eyebrow { display:block; font-size:9px; letter-spacing:2px; color:#6c7565; margin-bottom:20px; }
.auth-title { display:block; font-family:'Kaiti SC','STKaiti','KaiTi',var(--font-heading); font-size:36px; letter-spacing:2px; line-height:1.6; }
.auth-subtitle { display:block; white-space:pre-line; font-family:var(--font-heading); margin-top:18px; font-size:16px; line-height:2; color:#57644d; }
.auth-letter { margin:32px 0 28px; font-family:var(--font-heading); font-size:13px; line-height:2.1; }
.auth-letter text { display:block; }
.auth-actions { margin-top:auto; }
.auth-actions :deep(.action-button) { margin-top:12px; }
.auth-consent { display:flex; align-items:center; font-size:11px; line-height:1.9; color:#65705f; }
.auth-check { flex-shrink:0; width:44px; height:44px; padding:13px; margin:0 4px 0 -13px; display:flex; align-items:center; justify-content:center; background:transparent; }
.auth-check view { width:16px; height:16px; border:1px solid #8a947e; border-radius:4px; display:flex; align-items:center; justify-content:center; }
.auth-check .checked { background:#536b49; border-color:#536b49; }
.auth-policy { display:inline; padding:0; margin:0 0 0 3px; background:transparent; color:#425a3c; font-size:11px; line-height:1.9; }
.auth-note { display:block; margin-top:10px; text-align:center; font-size:10px; line-height:1.8; color:#737a6b; }
.auth-signature { text-align:center; font-size:9px; letter-spacing:3px; color:#89917d; margin-top:24px; }
.auth-connection { display:flex; align-items:center; gap:10px; font-size:12px; }
.auth-connection button { margin:0 0 0 auto; font-size:12px; color:#4c6547; background:transparent; }
@media(max-height:740px) { .auth-heading { margin-top:24px; } .auth-letter { margin:22px 0 28px; } .auth-title { font-size:32px; } .auth-signature { margin-top:24px; } }
.auth-new-demo { width:100%; text-align:center; background:transparent; color:#536a4e; font-size:12px; line-height:1.7; margin:8px auto 0; min-height:44px; padding:12px; }
.auth-new-demo[disabled] { color:#8c9586; }
</style>
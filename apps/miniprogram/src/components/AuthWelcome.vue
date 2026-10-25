<script setup lang="ts">
import { ref } from 'vue'
import type { ThemeDefinition } from '../themes'
import ActionButton from './ActionButton.vue'
import SvgIcon from './SvgIcon.vue'
export interface AuthWelcomeProps { theme: ThemeDefinition; busy: boolean; error: string; devAuth: boolean; ready: boolean; offline: boolean; connecting: boolean; wechatAuth?: boolean; hasDemo: boolean }
defineProps<AuthWelcomeProps>()
const emit = defineEmits<{ login: [mode: 'wechat' | 'demo-new' | 'demo-resume']; replay: []; privacy: []; retry: []; backgroundReady: [] }>()
const accepted = ref(false)
function login(mode: 'wechat' | 'demo-new' | 'demo-resume') { if (accepted.value) emit('login', mode) }
</script>

<template>
  <view class="auth-welcome">
    <image class="auth-background" :src="theme.image" mode="aspectFill" aria-hidden="true" @load="emit('backgroundReady')" @error="emit('backgroundReady')" />
    <view class="auth-shade" />
    <scroll-view class="auth-scroll" scroll-y enhanced>
      <view class="auth-content">
        <view class="auth-top"><text>AGENCY BLOOM</text><button :disabled="busy" @click="emit('replay')" hover-class="pressed">重看开场</button></view>
        <view class="auth-main">
        <view class="auth-heading"><text class="auth-title">给自己一点空间</text><text class="auth-subtitle">让每一次向前，都更靠近你愿意亲自度过的生活</text></view>
        <view class="auth-entry">
        <view class="auth-quote-scene">
          <view class="auth-quote-plane" aria-hidden="true" />
          <view class="auth-quote-passage">
            <text class="auth-quote-mark auth-quote-open" aria-hidden="true">“</text>
            <text class="auth-quote-copy">不必先想清楚一切，带着困惑或好奇来就好。我们从一件小事，慢慢聊起</text>
            <text class="auth-quote-mark auth-quote-close" aria-hidden="true">”</text>
          </view>
        </view>
        <view class="auth-actions">
          <text v-if="error" class="notice">{{ error }}</text>
          <view v-if="offline || connecting" class="auth-connection"><text>{{ connecting ? '正在连接服务…' : '暂时无法连接服务，请稍后重试' }}</text><button :disabled="connecting || busy" @click="emit('retry')">重试</button></view>
          <view class="auth-consent">
            <button class="auth-check" :aria-pressed="accepted" aria-label="同意用户协议与隐私政策" :disabled="busy" hover-class="auth-control-pressed" :hover-start-time="0" :hover-stay-time="70" @click="accepted = !accepted"><view :class="{ checked: accepted }"><SvgIcon v-if="accepted" name="check" light :size="12" /></view></button>
            <view class="auth-consent-copy"><text>我已阅读并同意</text><button class="auth-policy" hover-class="auth-control-pressed" :hover-start-time="0" :hover-stay-time="70" @click="emit('privacy')">用户协议与隐私政策</button></view>
          </view>
          <!-- #ifdef MP-WEIXIN -->
          <view class="auth-action"><ActionButton kind="auth-wechat" :disabled="!accepted || wechatAuth === false || connecting" :loading="busy" @click="login('wechat')">微信登录 / 注册</ActionButton></view>
          <!-- #endif -->
          <view v-if="devAuth" class="auth-action"><ActionButton kind="auth-demo" :disabled="!accepted || connecting" :loading="busy" @click="login(hasDemo ? 'demo-resume' : 'demo-new')">{{ hasDemo ? '继续本机演示' : '创建演示账号' }}</ActionButton></view>
          <button v-if="devAuth && hasDemo" class="auth-register-again" :disabled="!accepted || connecting || busy"
            hover-class="auth-control-pressed" :hover-start-time="0" @click="login('demo-new')">重新注册，开始新一轮测试</button>
        </view>
        </view>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<style lang="scss" src="../opening-serif.scss"></style>
<style scoped>
.auth-welcome { --font-heading:'Bloom Opening Serif','Songti SC','STSong',serif; --font-body:-apple-system,BlinkMacSystemFont,'PingFang SC','Noto Sans SC','Microsoft YaHei',sans-serif; --type-title:30px; --type-subtitle:13px; --type-card:15px; --type-button:15px; --auth-height:var(--app-height,100vh); height:var(--auth-height); position:relative; overflow:hidden; background:var(--bg); color:var(--ink); }
.auth-background,.auth-shade { position:absolute; top:0; right:0; bottom:0; left:0; width:100%; height:100%; pointer-events:none; }
.auth-background { display:block; transform:none; opacity:.9; }
.auth-shade { background:linear-gradient(180deg,rgba(247,246,243,.54) 0%,rgba(247,246,243,.25) 28%,rgba(249,244,233,.22) 52%,rgba(244,241,234,.29) 76%,rgba(239,240,235,.38) 100%); }
.auth-scroll { height:100%; position:relative; }
.auth-content { min-height:var(--auth-height); padding:calc(var(--capsule-bottom,64px) + 18px) 26px calc(28px + env(safe-area-inset-bottom,0px)); box-sizing:border-box; display:flex; flex-direction:column; }
.auth-top { display:flex; align-items:center; justify-content:space-between; font-size:12px; letter-spacing:3px; }
.auth-top button { min-height:44px; padding:10px 0 10px 16px; margin:0; font-size:12px; line-height:1.6; color:var(--muted); background:transparent; letter-spacing:0; }
button::after { border:0; }
.auth-main { position:relative; flex:1; display:flex; flex-direction:column; justify-content:flex-start; padding:clamp(62px,12vh,104px) 0 36px; }
.auth-heading { margin-top:0; }
.auth-title { display:block; font-family:var(--font-heading); font-size:var(--type-title); font-weight:400; line-height:1.5; letter-spacing:.2px; color:#263b40; }
.auth-subtitle { display:block; max-width:24em; margin-top:14px; font-family:var(--font-body); font-size:var(--type-subtitle); font-weight:400; line-height:1.8; color:#314348; text-shadow:0 1px 8px rgba(248,245,237,.5); }
.auth-entry { margin-top:28px; }
.auth-quote-scene { position:relative; z-index:1; margin:0 2px 18px; }
.auth-quote-plane { position:absolute; top:0; right:0; bottom:0; left:0; border:1px solid rgba(255,255,255,.65); border-radius:8px; background:linear-gradient(150deg,rgba(255,251,242,.82),rgba(255,249,239,.68)); box-shadow:inset 0 1px 0 rgba(255,255,255,.6),0 5px 16px rgba(41,55,65,.07); pointer-events:none; }
.auth-quote-passage { position:relative; padding:27px 27px 25px; }
.auth-quote-mark { position:absolute; font-family:Georgia,'Times New Roman',serif; font-size:40px; font-weight:400; line-height:1; color:var(--accent); opacity:.45; pointer-events:none; }
.auth-quote-open { left:13px; top:10px; }
.auth-quote-close { right:13px; bottom:0; }
.auth-quote-copy { display:block; font-family:var(--font-body); font-size:var(--type-card); font-weight:400; line-height:1.95; color:#293f43; }
.auth-actions { position:relative; z-index:0; margin-top:clamp(32px,7vh,60px); }
.auth-action { margin-top:10px; }
.auth-register-again { display:block; width:100%; min-height:44px; margin:8px 0 0; padding:12px 8px; background:transparent; color:var(--ink); font-family:var(--font-body); font-size:var(--type-button); line-height:1.6; }
.auth-register-again[disabled] { color:var(--muted); opacity:.55; }
.auth-consent { display:flex; align-items:center; gap:0; min-height:44px; font-family:var(--font-body); font-size:var(--type-subtitle); line-height:1.7; color:#3b5055; }
.auth-consent-copy { display:flex; align-items:center; flex-wrap:wrap; column-gap:4px; flex:1; min-width:0; }
.auth-check { flex:0 0 44px; width:44px; height:44px; padding:13px; margin:0; display:flex; align-items:center; justify-content:center; background:transparent; }
.auth-check view { width:16px; height:16px; border:1px solid #8a947e; border-radius:4px; display:flex; align-items:center; justify-content:center; }
.auth-check .checked { background:#355e67; border-color:#355e67; }
.auth-policy { display:inline-flex; align-items:center; min-height:44px; max-width:100%; padding:0; margin:0; background:transparent; color:#304e59; font-family:inherit; font-size:inherit; line-height:1.7; text-decoration:underline; text-underline-offset:3px; }
.auth-connection { display:flex; align-items:center; gap:10px; font-size:12px; }
.auth-connection button { margin:0 0 0 auto; font-size:12px; color:var(--accent); background:transparent; }
.auth-welcome button { touch-action:manipulation; -webkit-tap-highlight-color:transparent; user-select:none; -webkit-user-select:none; -webkit-touch-callout:none; }
.auth-welcome button:focus-visible { outline:2px solid var(--accent); outline-offset:3px; }
.auth-control-pressed,.auth-check:active,.auth-policy:active { opacity:.65; }
@media(max-width:350px) { .auth-content { padding-left:22px; padding-right:22px; } .auth-quote-passage { padding-left:26px; padding-right:26px; } }
@media(max-height:740px) { .auth-main { padding-top:32px; padding-bottom:18px; } .auth-actions { margin-top:24px; } .auth-entry { margin-top:22px; } .auth-quote-scene { margin-bottom:16px; } }
/* #ifdef H5 */
.auth-scroll :deep(.uni-scroll-view) { overscroll-behavior:contain; }
@supports(height:100dvh) { .auth-welcome { --auth-height:100dvh; } }
/* #endif */
/* One quiet entrance; controls remain usable throughout. */
.auth-heading,.auth-quote-scene,.auth-actions { animation:auth-enter 220ms cubic-bezier(.22,1,.36,1) both; }
.auth-quote-scene { animation-delay:40ms; }
.auth-actions { animation-delay:80ms; }
@keyframes auth-enter { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
@media(prefers-reduced-motion:reduce) { .auth-welcome button { transition:none; } .auth-heading,.auth-quote-scene,.auth-actions { animation:none; } }
</style>

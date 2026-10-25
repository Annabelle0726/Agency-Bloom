<script setup lang="ts">
import SvgIcon from './SvgIcon.vue'
import type { HomeEntry } from '../home-entry'

defineOptions({ options: { styleIsolation: 'apply-shared' } })
const props=withDefaults(defineProps<{ entry: HomeEntry; busy?: boolean; hasConcern?: boolean; foreground?: boolean }>(), { busy: false, hasConcern: false, foreground:true })
const emit = defineEmits<{ continue: []; details: [] }>()
function openChat() { if(!props.busy) emit('continue') }
</script>

<template>
  <view class="bloom-home-section" :class="{'bloom-paused': !foreground || busy}">
    <view class="bloom-home-card" data-home="bloom-card">
      <view class="bloom-card-copy">
        <view class="bloom-card-heading">
          <text class="bloom-card-title">{{ entry.title }}</text>
          <view class="bloom-topic-symbol" aria-hidden="true"><SvgIcon name="leaf" :size="20" tone="accent" /></view>
        </view>
        <text v-if="entry.stamp" class="bloom-card-stamp">{{ entry.stamp }}</text>
        <text class="bloom-card-detail">{{ entry.detail }}</text>
        <view v-if="entry.kept" class="bloom-kept"><text class="bloom-kept-label">你留下的话</text><text class="bloom-kept-text">{{ entry.kept }}</text></view>
      </view>
      <view v-if="hasConcern" class="bloom-card-footer">
        <button class="bloom-details" data-home="details" hover-class="bloom-pressed" :hover-start-time="0" @click="emit('details')">查看与修改</button>
      </view>
      <view class="bloom-card-companion">
        <button class="bloom-character-button" data-home="bloom" :disabled="busy" :aria-label="busy ? '正在打开对话' : '轻触 Bloom，' + entry.action" hover-class="bloom-character-pressed" :hover-start-time="0" :hover-stay-time="70" @click="openChat">
          <image class="bloom-character" src="/static/bloom-home-top.png" mode="aspectFit" aria-hidden="true" />
        </button>
      </view>
      <view class="bloom-invitation" data-home="invitation">
        <text>{{ busy ? '正在打开对话…' : entry.bubble }}</text>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.bloom-home-section { position:relative; z-index:2; margin:-27px 0 18px; padding-top:52px; }
.bloom-home-card { position:relative; box-sizing:border-box; padding:20px 22px 16px; overflow:visible; border:1px solid var(--quote-border); border-radius:8px; background:linear-gradient(155deg,var(--quote-fill-a),var(--quote-fill-b)); box-shadow:var(--quote-inset),var(--quote-shadow); -webkit-backdrop-filter:blur(12px); backdrop-filter:blur(12px); }
.bloom-card-copy { position:relative; z-index:1; }
.bloom-card-heading { display:flex; align-items:center; justify-content:flex-start; gap:8px; }
.bloom-topic-symbol { display:flex; align-items:center; justify-content:center; flex:0 0 24px; width:24px; height:24px; }
.bloom-card-stamp { display:block; color:var(--muted); font-family:var(--font-body); font-size:10.5px; line-height:1.7; margin-top:6px; }
.bloom-card-title { display:block; flex:0 1 auto; min-width:0; color:var(--ink); font-family:var(--font-heading); font-size:18px; line-height:1.9; letter-spacing:.4px; font-weight:400; overflow-wrap:break-word; }
.bloom-card-detail { display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:3; overflow:hidden; color:var(--muted); font-family:var(--font-body); font-size:13px; line-height:1.9; margin-top:8px; }
.bloom-kept { margin-top:13px; }
.bloom-kept-label { display:block; color:var(--accent); font-size:10px; line-height:1.8; letter-spacing:.7px; }
.bloom-kept-text { display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:2; overflow:hidden; color:var(--ink); font-size:12px; line-height:1.8; margin-top:3px; }
.bloom-card-footer { position:relative; z-index:2; display:flex; justify-content:flex-end; align-items:center; margin-top:8px; }
.bloom-details { min-height:44px; display:flex; justify-content:flex-end; align-items:center; padding:0; margin:0 0 0 auto; background:transparent; color:var(--muted); font-family:var(--font-body); font-size:11px; line-height:1.6; white-space:nowrap; }
.bloom-details::after,.bloom-character-button::after { border:0; }
.bloom-card-companion { position:absolute; z-index:3; right:0; top:-74px; width:76px; }
.bloom-invitation { position:absolute; z-index:4; top:-48px; right:84px; display:inline-flex; align-items:center; box-sizing:border-box; width:auto; padding:6px 10px; border:1px solid var(--quote-border); border-radius:8px; background:linear-gradient(155deg,var(--quote-fill-a),var(--quote-fill-b)); color:var(--ink); box-shadow:var(--quote-inset),var(--quote-shadow); -webkit-backdrop-filter:blur(12px); backdrop-filter:blur(12px); animation:bloom-invite-enter 230ms ease-out both; }
.bloom-invitation > text { display:block; flex-shrink:0; font-family:var(--font-body); font-size:11.5px; line-height:1.7; white-space:nowrap; }
.bloom-invitation::after { content:''; position:absolute; right:-5px; top:11px; width:8px; height:8px; transform:rotate(45deg); background:var(--paper); border-right:1px solid var(--quote-border); border-top:1px solid var(--quote-border); }
.bloom-character-button { display:flex; align-items:center; justify-content:center; width:76px; height:82px; padding:0; margin:0; background:transparent; line-height:0; border:0; border-radius:0; overflow:visible; }
/* Native disabled/pressed button defaults must never paint behind transparent artwork. */
.bloom-character-button,.bloom-character-button[disabled],.bloom-character-button:active,.bloom-character-button.bloom-character-pressed { background:transparent !important; box-shadow:none !important; }
.bloom-character-button[disabled] { opacity:1 !important; }
.bloom-character { display:block; width:76px; height:82px; pointer-events:none; transform-origin:50% 94%; animation:bloom-rest 5.8s ease-in-out infinite; transition:opacity 100ms ease-out; }
.bloom-pressed { transform:scale(.98); opacity:.85; }
.bloom-character-pressed .bloom-character { opacity:.78; }
.bloom-character-button[disabled] .bloom-character { opacity:.62; }
.bloom-paused .bloom-character { animation-play-state:paused; }
@keyframes bloom-rest { 0%,100% { transform:scale(1); } 50% { transform:scaleX(1.006) scaleY(1.012); } }
@keyframes bloom-invite-enter { from { opacity:0; transform:translateY(3px); } to { opacity:1; transform:translateY(0); } }
@media (max-width:360px) {
  .bloom-home-card { padding:18px 18px 14px; }
  .bloom-card-title { font-size:17px; }
  .bloom-card-companion { right:0; top:-69px; width:70px; }
  .bloom-invitation { right:76px; top:-45px; }
  .bloom-character-button,.bloom-character { width:70px; height:76px; }
}
@media (prefers-reduced-motion:reduce) { .bloom-invitation,.bloom-character { animation:none; } .bloom-character { transition:none; } }
</style>

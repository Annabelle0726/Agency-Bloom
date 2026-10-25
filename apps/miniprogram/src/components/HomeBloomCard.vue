<script setup lang="ts">
import { computed, ref } from 'vue'
import SvgIcon from './SvgIcon.vue'
import type { HomeEntry } from '../home-entry'
import greeting from '../bloom-greeting.generated.json'

defineOptions({ options: { styleIsolation: 'apply-shared' } })
const props=withDefaults(defineProps<{ entry: HomeEntry; busy?: boolean; hasConcern?: boolean; foreground?: boolean }>(), { busy: false, hasConcern: false, foreground:true })
const emit = defineEmits<{ continue: []; details: []; context: [] }>()
const greetingLoaded=ref(false),greetingDone=ref(false),greetingFailed=ref(false)
const phase=computed(()=>greetingFailed.value?'fallback':greetingDone.value?'complete':greetingLoaded.value?'playing':'waiting')
function loadGreeting() { if(!greetingFailed.value) greetingLoaded.value=true }
function finishGreeting(event:{animationName?:string;detail?:{animationName?:string}}) {
  const name=event.detail?.animationName || event.animationName || ''
  if(greetingLoaded.value && name.startsWith('bloom-greet')) greetingDone.value=true
}
function failGreeting() { greetingFailed.value=true;greetingDone.value=true }
function openChat() { if(!props.busy) emit('continue') }
</script>

<template>
  <view class="bloom-home-section" data-home="greeting-stage" :data-phase="phase" :class="{'bloom-paused': !foreground || busy,'bloom-greeting-loaded':greetingLoaded&&!greetingFailed,'bloom-greeting-complete':greetingDone,'bloom-opening':busy}">
    <view class="bloom-home-card" data-home="bloom-card">
      <view class="bloom-card-copy">
        <view class="bloom-card-heading">
          <text class="bloom-card-kicker">{{ entry.kicker }}</text>
          <view class="bloom-topic-symbol" aria-hidden="true"><SvgIcon name="leaf" :size="18" tone="accent" /></view>
        </view>
        <view class="bloom-card-title" :class="{'bloom-question-framed':hasConcern}">
          <view v-if="hasConcern" class="bloom-question-corner bloom-question-opening" data-home="question-opening" aria-hidden="true" />
          <text class="bloom-question-text" data-home="question" :selectable="true">{{ entry.title }}</text>
          <view v-if="hasConcern" class="bloom-question-corner bloom-question-closing" data-home="question-closing" aria-hidden="true" />
        </view>
        <text v-if="entry.detail" class="bloom-card-detail">{{ entry.detail }}</text>
      </view>
      <view v-if="entry.stamp || hasConcern" class="bloom-card-footer">
        <button v-if="entry.hasInitialContext" class="bloom-context" data-home="context" aria-label="查看起点详情" hover-class="bloom-pressed" :hover-start-time="0" @click="emit('context')">{{ entry.stamp }}</button>
        <text v-else class="bloom-card-stamp">{{ entry.stamp }}</text>
        <button v-if="hasConcern" class="bloom-details" data-home="details" hover-class="bloom-pressed" :hover-start-time="0" @click="emit('details')">查看与修改</button>
      </view>
      <view class="bloom-card-companion">
        <button class="bloom-character-button" data-home="bloom" :disabled="busy" :aria-label="busy ? '正在打开对话' : '轻触 Bloom，' + entry.action" hover-class="bloom-character-pressed" :hover-start-time="0" :hover-stay-time="70" @click="openChat">
          <view class="bloom-portrait">
            <image class="bloom-character" src="/static/bloom-home-top.png" mode="aspectFit" aria-hidden="true" />
            <view class="bloom-greeting-viewport" aria-hidden="true">
              <view class="bloom-greeting-sheet" data-home="greeting-animation"
                :style="{width:greeting.columns*100+'%',height:greeting.rows*100+'%',animationDuration:greeting.durationMs+'ms'}"
                @animationend="finishGreeting">
                <image class="bloom-greeting-atlas" data-home="greeting-sprite" :src="greeting.asset" mode="scaleToFill" @load="loadGreeting" @error="failGreeting" />
              </view>
            </view>
          </view>
        </button>
      </view>
      <view class="bloom-invitation" data-home="invitation">
        <text>{{ busy ? '正在打开对话…' : entry.bubble }}</text>
      </view>
      <image class="bloom-avatar-preload" src="/static/companion-bot.png" mode="aspectFit" aria-hidden="true" />
    </view>
  </view>
</template>

<style scoped lang="scss">
@use '../bloom-greeting.generated.scss';

.bloom-home-section { position:relative; z-index:2; margin:-27px 0 18px; padding-top:52px; }
.bloom-home-card { position:relative; box-sizing:border-box; padding:20px 20px 12px; overflow:visible; border:1px solid var(--quote-border); border-radius:8px; background:linear-gradient(155deg,var(--quote-fill-a),var(--quote-fill-b)); box-shadow:var(--quote-inset),var(--quote-shadow); -webkit-backdrop-filter:blur(12px); backdrop-filter:blur(12px); }
.bloom-card-copy { position:relative; z-index:1; }
.bloom-card-heading { display:flex; flex-direction:row; flex-wrap:nowrap; align-items:center; justify-content:flex-start; gap:8px; }
.bloom-card-kicker { display:block; flex:0 1 auto; min-width:0; color:var(--muted); font-family:var(--font-body); font-size:12px; line-height:18px; letter-spacing:.6px; }
.bloom-topic-symbol { display:flex; align-items:center; justify-content:center; flex:0 0 20px; width:20px; height:20px; }
.bloom-card-stamp { display:block; min-width:0; color:var(--muted); font-family:var(--font-body); font-size:11px; line-height:18px; }
.bloom-card-title { position:relative; display:inline-block; box-sizing:border-box; max-width:100%; min-width:0; margin-top:8px; color:var(--ink); font-family:var(--font-heading); font-size:24px; line-height:36px; letter-spacing:.4px; font-weight:400; overflow-wrap:break-word; }
.bloom-question-framed { padding:5px 12px; }
.bloom-question-corner { position:absolute; box-sizing:border-box; width:9px; height:11px; border-color:var(--accent); border-style:solid; border-width:0; opacity:.6; pointer-events:none; }
.bloom-question-opening { top:0; left:0; border-top-width:1px; border-left-width:1px; }
.bloom-question-closing { right:0; bottom:0; border-right-width:1px; border-bottom-width:1px; }
.bloom-card-detail { display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:3; overflow:hidden; color:var(--muted); font-family:var(--font-body); font-size:13px; line-height:23px; margin-top:10px; }
.bloom-details,.bloom-context { display:flex; align-items:center; box-sizing:border-box; flex-shrink:0; min-height:44px; padding:0; margin:-8px 0; background:transparent; border-radius:6px; color:var(--muted); font-family:var(--font-body); font-size:11px; font-weight:400; line-height:18px; }
.bloom-details { justify-content:flex-end; margin-left:auto; }
.bloom-card-footer { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-top:16px; min-height:28px; }
.bloom-context { justify-content:flex-start; flex-shrink:1; min-width:0; }
.bloom-details::after,.bloom-context::after,.bloom-character-button::after { border:0; }
.bloom-card-companion { position:absolute; z-index:3; right:0; top:-74px; width:76px; }
.bloom-invitation { position:absolute; z-index:4; top:-48px; right:84px; display:inline-flex; align-items:center; box-sizing:border-box; width:auto; padding:6px 10px; border:1px solid var(--quote-border); border-radius:8px; background:linear-gradient(155deg,var(--quote-fill-a),var(--quote-fill-b)); color:var(--ink); box-shadow:var(--quote-inset),var(--quote-shadow); -webkit-backdrop-filter:blur(12px); backdrop-filter:blur(12px); opacity:0; visibility:hidden; transform:translateY(3px); transition:opacity 200ms ease-out,transform 200ms ease-out; }
.bloom-greeting-complete .bloom-invitation,.bloom-opening .bloom-invitation { opacity:1; visibility:visible; transform:none; }
.bloom-invitation > text { display:block; flex-shrink:0; font-family:var(--font-body); font-size:11.5px; line-height:1.7; white-space:nowrap; }
.bloom-invitation::after { content:''; position:absolute; right:-5px; top:11px; width:8px; height:8px; transform:rotate(45deg); background:var(--paper); border-right:1px solid var(--quote-border); border-top:1px solid var(--quote-border); }
.bloom-character-button { display:flex; align-items:center; justify-content:center; width:76px; height:82px; padding:0; margin:0; background:transparent; line-height:0; border:0; border-radius:0; overflow:visible; }
/* Native disabled/pressed button defaults must never paint behind transparent artwork. */
.bloom-character-button,.bloom-character-button[disabled],.bloom-character-button:active,.bloom-character-button.bloom-character-pressed { background:transparent !important; box-shadow:none !important; }
.bloom-character-button[disabled] { opacity:1 !important; }
.bloom-portrait { position:relative; width:76px; height:82px; pointer-events:none; transition:opacity 100ms ease-out; }
.bloom-character { display:block; width:100%; height:100%; pointer-events:none; }
.bloom-greeting-viewport { position:absolute; inset:0; overflow:hidden; opacity:0; pointer-events:none; }
.bloom-greeting-sheet { position:absolute; left:0; top:0; max-width:none; }
.bloom-greeting-atlas { display:block; width:100%; height:100%; }
.bloom-greeting-loaded .bloom-greeting-viewport { opacity:1; }
.bloom-greeting-loaded .bloom-character { opacity:0; }
.bloom-greeting-loaded .bloom-greeting-sheet { animation-name:bloom-greet; animation-timing-function:steps(1,end); animation-iteration-count:1; animation-fill-mode:both; }
.bloom-avatar-preload { position:absolute; width:1px; height:1px; opacity:0; pointer-events:none; }
.bloom-pressed { transform:scale(.98); opacity:.85; }
.bloom-character-pressed .bloom-portrait { opacity:.78; }
.bloom-character-button[disabled] .bloom-portrait { opacity:.72; }
.bloom-paused .bloom-greeting-sheet { animation-play-state:paused; }
/* #ifdef MP-WEIXIN */
/* Keep the theme's material without a backdrop compositing layer on native. */
.bloom-home-card,.bloom-invitation { -webkit-backdrop-filter:none; backdrop-filter:none; }
/* #endif */
@media (max-width:360px) {
  .bloom-home-card { padding:18px 18px 8px; }
  .bloom-card-companion { right:0; top:-69px; width:70px; }
  .bloom-invitation { right:76px; top:-45px; }
  .bloom-character-button,.bloom-portrait { width:70px; height:76px; }
}
@media (prefers-reduced-motion:reduce) {
  .bloom-greeting-loaded .bloom-greeting-viewport { opacity:0; }
  .bloom-greeting-loaded .bloom-character { opacity:1; }
  .bloom-greeting-loaded .bloom-greeting-sheet { animation:none; }
  .bloom-invitation { opacity:1; visibility:visible; transform:none; transition:none; }
  .bloom-portrait { transition:none; }
}
</style>

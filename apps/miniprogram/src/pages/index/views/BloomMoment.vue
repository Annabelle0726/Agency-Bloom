<script setup lang="ts">
import { computed, ref, watch, onUnmounted } from 'vue'
import SvgIcon from '../../../components/SvgIcon.vue'
import CompanionAvatar from '../../../components/CompanionAvatar.vue'
import { momentLabels, momentVisual, type Moment } from '../../../bloom-moment'

defineOptions({ options: { styleIsolation: 'apply-shared' } })
const props = defineProps<{
  moment: Moment | null; day: string; themeId: string; loading: boolean; generating: boolean
  error: string; personalize: boolean; canPersonalize: boolean; consentOpen: boolean; retained: boolean; demo: boolean
}>()
const emit = defineEmits<{
  open: [another: boolean]; dismiss: []; chat: []; personalize: []; consent: []; decline: []; recover: []
}>()
const content = computed(() => props.moment?.dismissed ? null : props.moment?.content)
const art = computed(() => momentVisual(content.value?.kind || 'light', props.themeId, props.day, props.moment?.id))
const busy = computed(() => props.loading || props.generating)
const arrived = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined
watch(() => props.moment?.id, () => {
  if (!content.value) return
  arrived.value = true; clearTimeout(timer); timer = setTimeout(() => { arrived.value = false }, 650)
})
onUnmounted(() => clearTimeout(timer))
</script>

<template>
  <view class="bloom-moment" data-moment="root">
    <view class="moment-head">
      <view><text class="moment-kicker">BLOOM MOMENT</text><text class="moment-name">今天的一点惊喜</text></view>
      <CompanionAvatar :size="42" :online="false" :state="generating ? 'thinking' : arrived ? 'speaking' : 'rest'" />
    </view>
    <view class="moment-scene">
      <image v-if="art" class="moment-image" :src="art.src" mode="aspectFill" aria-hidden="true" />
      <view class="moment-copy" :class="{ 'has-art': !!art }">
        <text v-if="content" class="moment-flavor">{{ momentLabels[content.kind] }}</text>
        <text class="moment-title">{{ content?.title || (moment?.dismissed ? '那就让它轻轻过去' : '今天，也许有一点新可能') }}</text>
        <template v-if="content">
          <view v-for="source in content.sources" :key="source.id" class="moment-source">
            <text class="moment-source-date">你在 {{ source.date }} 确认过 · 现在可以不同</text>
            <text>「{{ source.quote }}」</text>
          </view>
          <text class="moment-body">{{ content.invitation }}</text>
          <text class="moment-question">{{ content.question }}</text>
        </template>
        <text v-else class="moment-body">{{ moment?.dismissed ? '不需要解释，也不急着找下一件事' : '不需要先提出问题，也不必完成什么\n只是为你留下一点好奇' }}</text>
      </view>
    </view>
    <text v-if="demo || moment?.demo" class="moment-disclosure">本地互动示例 · 不是 DeepSeek 生成</text>
    <text v-else-if="content" class="moment-disclosure">AI 给出的小邀请，可以略过 · {{ retained ? '随聊天保存设置保留' : '内容仅留在本次打开期间' }}</text>
    <view v-if="consentOpen" class="moment-consent">
      <text>点开时会请 DeepSeek 准备一份体验，使用现有 AI 额度。可选使用你已启用、确认过的全局记忆；不发送其他会话。AI 内容可能有误，保存遵循聊天保存设置，可在「我的」撤回授权</text>
      <button data-moment="consent" :disabled="busy" @click="emit('consent')">同意并拆开</button>
      <button :disabled="busy" @click="emit('decline')">先不拆开</button>
    </view>
    <template v-else>
      <button v-if="!content && !moment" class="moment-open" data-moment="open" :disabled="busy" @click="emit('open', false)" hover-class="pressed" :hover-start-time="0">
        <SvgIcon name="sparkles" :size="18" tone="accent" /><text>{{ generating ? '正在准备这一点好奇' : loading ? '正在查看' : '拆开今天的小惊喜' }}</text><SvgIcon name="arrow" :size="17" tone="accent" />
      </button>
      <view v-else class="moment-actions">
        <button v-if="content" class="moment-talk" data-moment="chat" :disabled="busy" @click="emit('chat')" hover-class="pressed"><SvgIcon name="chat" :size="16" tone="accent" /><text>聊聊这个</text></button>
        <button v-if="content" data-moment="dismiss" :disabled="busy" @click="emit('dismiss')" hover-class="pressed">不感兴趣</button>
        <button v-if="moment?.status !== 'pending'" data-moment="another" :disabled="busy" @click="emit('open', true)" hover-class="pressed">{{ generating ? '正在准备' : '再来一个' }}</button>
      </view>
      <button v-if="canPersonalize && !busy" class="moment-personalize" data-moment="personalize" role="checkbox" :aria-checked="personalize" @click="emit('personalize')">
        <SvgIcon :name="personalize ? 'check' : 'plus'" :size="14" tone="muted" /><text>用我确认过的全局记忆找一点联系</text>
      </button>
    </template>
    <view v-if="error || moment?.status === 'pending' || (moment && !content && !moment.dismissed)" class="moment-notice" data-moment="notice">
      <text>{{ error || (moment?.status === 'pending' ? '小惊喜还在准备，稍后可以查看' : '内容没有保留在这里，可以主动换一个') }}</text>
      <button :disabled="busy" data-moment="recover" @click="emit('recover')">查看结果</button>
    </view>
  </view>
</template>

<style scoped lang="scss">
.bloom-moment { margin: 18px 0; border: 1px solid var(--line); border-radius: 8px; background: var(--paper); color: var(--ink); overflow: hidden; }
.moment-head { display:flex; justify-content:space-between; align-items:center; padding:18px 18px 14px; }
.moment-head > view { display:flex; flex-direction:column; gap:5px; }
.moment-kicker { font-size:10px; letter-spacing:2px; color:var(--accent); }
.moment-name { font-family:var(--font-heading); font-size:20px; font-weight:600; }
.moment-scene { position:relative; min-height:170px; }
.moment-image { position:absolute; right:0; top:0; width:29%; height:100%; opacity:.9; }
.moment-copy { position:relative; padding:8px 18px 18px; display:flex; flex-direction:column; gap:12px; }
.moment-copy.has-art { margin-right:29%; padding-right:14px; }
.moment-title { font-family:var(--font-heading); font-size:19px; line-height:1.55; }
.moment-flavor { font-size:11px; color:var(--accent); }
.moment-body { font-size:14px; line-height:1.85; white-space:pre-line; }
.moment-question { font-size:14px; line-height:1.8; color:var(--accent); }
.moment-source { display:flex; flex-direction:column; gap:7px; font-size:13px; line-height:1.8; border-left:2px solid var(--line); padding-left:10px; }
.moment-source-date { font-size:10px; color:var(--muted); }
.moment-disclosure { display:block; padding:8px 18px 0; font-size:10px; line-height:1.7; color:var(--muted); }
.bloom-moment button { margin:0; background:transparent; color:var(--ink); border:0; border-radius:6px; font-size:12px; padding:0 10px; min-height:44px; display:flex; align-items:center; justify-content:center; gap:6px; line-height:1.5; }
.bloom-moment button::after { border:0; }
.bloom-moment button[disabled] { opacity:.5; }
.bloom-moment .moment-open { width:calc(100% - 36px); margin:12px 18px; justify-content:space-between; border:1px solid var(--line); color:var(--accent); font-size:13px; }
.moment-actions { display:flex; flex-wrap:wrap; align-items:center; padding:6px 8px; }
.bloom-moment .moment-talk { margin-right:auto; color:var(--accent); }
.bloom-moment .moment-personalize { justify-content:flex-start; padding:0 18px; color:var(--muted); font-size:11px; text-align:left; }
.moment-notice { padding:8px 18px; color:var(--muted); font-size:12px; line-height:1.7; }
.moment-notice button { justify-content:flex-start; padding:0; color:var(--accent); }
.moment-consent { padding:12px 18px; border-top:1px solid var(--line); font-size:12px; line-height:1.8; }
.moment-consent button { display:inline-flex; color:var(--accent); }
.pressed { opacity:.7; }
@media (max-width:350px) { .moment-copy.has-art { margin-right:24%; } .moment-image { width:24%; } .moment-title { font-size:17px; } .moment-actions button { font-size:11px; padding:0 8px; } }
</style>

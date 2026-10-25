<script setup lang="ts">
import { computed, ref, watch, onUnmounted } from 'vue'
import SvgIcon from '../../../components/SvgIcon.vue'
import { momentLabels, momentVisual, type Moment } from '../../../bloom-moment'

defineOptions({ options: { styleIsolation: 'apply-shared' } })
const props = defineProps<{
  foreground: boolean; moment: Moment | null; day: string; themeId: string; loading: boolean; generating: boolean
  error: string; personalize: boolean; canPersonalize: boolean; consentOpen: boolean; retained: boolean; demo: boolean
}>()
const emit = defineEmits<{
  open: [another: boolean]; dismiss: []; chat: []; personalize: []; consent: []; decline: []; recover: []
}>()
const content = computed(() => props.moment?.dismissed ? null : props.moment?.content)
const art = computed(() => momentVisual(content.value?.kind || 'light', props.themeId, props.day, props.moment?.id))
const dateLabel = computed(() => /^\d{4}-\d{2}-\d{2}$/.test(props.day) ? `${Number(props.day.slice(5, 7))} 月 ${Number(props.day.slice(8))} 日` : '')
// Wrap at actual phrase boundaries; preserve every character of the response.
const questionPhrases = computed(() => (content.value?.question.match(/[^，。；？！]+[，。；？！]*|[，。；？！]+/gu) || [])
  .map(value => ({ value, keepTogether: Array.from(value).length <= 12 })))
const busy = computed(() => props.loading || props.generating)
const expanded = ref(false), aboutOpen = ref(false)
watch(() => props.generating, generating => { if (generating) expanded.value = true })
const arrived = ref(false), artFailed = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined
watch(() => art.value?.src, () => { artFailed.value = false })
watch(() => props.moment?.id, () => {
  if (!content.value) return
  arrived.value = true; clearTimeout(timer); timer = setTimeout(() => { arrived.value = false }, 650)
})
onUnmounted(() => clearTimeout(timer))
</script>

<template>
  <view class="bloom-moment" :class="{ 'is-arriving': arrived, 'is-collapsed': !expanded }" data-moment="root" :aria-busy="busy">
    <view class="moment-edition">
      <view class="moment-signature"><view class="moment-seed" aria-hidden="true" /><text class="moment-brand">Bloom Moment</text></view>
      <view class="moment-edition-meta"><text>{{ dateLabel }}</text>
        <button v-if="content" class="moment-toggle" data-moment="toggle" :aria-expanded="expanded" aria-controls="moment-details"
                :aria-label="expanded ? '收起惊喜正文，保留图片与标题' : '展开惊喜正文'" @click="expanded = !expanded" hover-class="moment-pressed" :hover-start-time="0">
          <text>{{ expanded ? '收起' : '展开' }}</text><view class="moment-fold-icon" :class="{ open: expanded }"><SvgIcon name="chevron" :size="14" tone="muted" /></view>
        </button>
      </view>
    </view>
    <view v-if="art && !artFailed" class="moment-picture" aria-hidden="true">
      <image :key="art.src" class="moment-image" :src="art.src" mode="aspectFill" @error="artFailed = true" />
      <view class="moment-picture-shade" /><view class="moment-picture-caption"><text>{{ content ? momentLabels[content.kind] : '给日常，留一点意外' }}</text><view class="moment-picture-line" /></view>
    </view>
    <view class="moment-heading">
      <view class="moment-heading-copy">
        <text class="moment-title">{{ content?.title || (moment?.dismissed ? '那就让它轻轻过去' : '今天的一点惊喜') }}</text>
        <text v-if="!content" class="moment-intro">{{ moment?.dismissed ? '不需要解释\n也不急着找下一件事' : '不必先有问题\n为今天留一点意料之外' }}</text>
      </view>
    </view>
    <view v-if="expanded && content" id="moment-details" class="moment-detail" :key="moment?.id">
      <view v-for="source in content.sources" :key="source.id" class="moment-source">
        <text class="moment-source-date">你在 {{ source.date }} 确认过 · 现在可以不同</text>
        <text class="moment-quote">「{{ source.quote }}」</text>
      </view>
      <text class="moment-body">{{ content.invitation }}</text>
      <view class="moment-question"><text v-for="(phrase, index) in questionPhrases" :key="index" :class="{ 'moment-phrase': phrase.keepTogether }">{{ phrase.value }}</text></view>
      <button class="moment-inline-fold" data-moment="fold-body" @click="expanded = false" hover-class="moment-pressed" :hover-start-time="0"><text>收起正文</text><view class="moment-fold-icon open"><SvgIcon name="chevron" :size="14" tone="muted" /></view></button>
    </view>
    <view v-if="consentOpen" class="moment-consent">
      <text class="moment-consent-title">请 AI 准备这一份小惊喜</text>
      <text>使用现有 AI 额度，内容可能有误。只在你勾选时使用已启用、确认过的全局记忆，不发送其他会话</text>
      <text>保存遵循聊天保存设置，可在「我的」撤回授权</text>
      <view class="moment-consent-actions">
        <button class="moment-primary" data-moment="consent" :disabled="busy" @click="emit('consent')" hover-class="moment-pressed" :hover-start-time="0">同意并拆开</button>
        <button :disabled="busy" @click="emit('decline')" hover-class="moment-pressed">先不拆开</button>
      </view>
    </view>
    <template v-else>
      <view class="moment-main-action">
        <button v-if="!content && !moment" class="moment-primary" data-moment="open" :disabled="busy" @click="expanded = true; emit('open', false)" hover-class="moment-pressed" :hover-start-time="0">
          <text>{{ generating ? '正在准备' : loading ? '正在查看' : '拆开看看' }}</text><SvgIcon name="arrow" :size="17" tone="ink" />
        </button>
        <button v-else-if="content && !expanded" class="moment-primary" data-moment="read" @click="expanded = true" hover-class="moment-pressed"><text>展开读一读</text><SvgIcon name="arrow" :size="17" tone="ink" /></button>
        <button v-else-if="content" class="moment-primary" data-moment="chat" :disabled="busy" @click="emit('chat')" hover-class="moment-pressed" :hover-start-time="0">
          <text>聊聊这个</text><SvgIcon name="arrow" :size="17" tone="ink" />
        </button>
        <button v-else-if="moment?.status !== 'pending'" class="moment-primary" data-moment="another" :disabled="busy" @click="emit('open', true)" hover-class="moment-pressed" :hover-start-time="0">{{ generating ? '正在准备' : '再来一个' }}</button>
        <view v-else class="moment-pending" role="status">小惊喜还在准备</view>
      </view>
      <view v-if="content" class="moment-secondary-actions">
        <button data-moment="another" :disabled="busy" @click="emit('open', true)" hover-class="moment-pressed" :hover-start-time="0">{{ generating ? '正在准备' : '再来一个' }}</button>
        <button data-moment="dismiss" :disabled="busy" @click="emit('dismiss')" hover-class="moment-pressed" :hover-start-time="0">不感兴趣</button>
      </view>
      <button v-if="canPersonalize" class="moment-personalize" data-moment="personalize" role="checkbox" :aria-checked="personalize" :disabled="busy" @click="emit('personalize')" hover-class="moment-pressed" :hover-start-time="0">
        <view class="moment-checkbox" :class="{ checked: personalize }"><SvgIcon v-if="personalize" name="check" :size="13" tone="accent" /></view>
        <text>{{ content ? '下次用已确认的记忆，找一点联系' : '用已确认的记忆，找一点联系' }}</text>
      </button>
    </template>
    <view v-if="content" class="moment-footnote">
      <text class="moment-human-note">一份小小的灵感，留给愿意停一停的你</text>
      <button class="moment-about" data-moment="about" :aria-expanded="aboutOpen" aria-label="了解这份灵感的来源与保存方式" @click="aboutOpen = !aboutOpen" hover-class="moment-pressed"><SvgIcon name="more" :size="16" tone="muted" /></button>
    </view>
    <text v-if="demo || moment?.demo" class="moment-disclosure">本地互动示例 · 不是 DeepSeek 生成</text>
    <text v-if="content && aboutOpen" class="moment-disclosure" data-moment="disclosure">由 AI 生成，可能有不周全的地方，你可以保留自己的看法。{{ retained ? '会依照你的聊天保存偏好留下，可在「我的」调整' : '这次打开时可以阅读，不作长期保存' }}</text>
    <view v-if="error || moment?.status === 'pending' || (moment && !content && !moment.dismissed)" class="moment-notice" data-moment="notice" role="status">
      <text>{{ error || (moment?.status === 'pending' ? '稍后可以查看，不会重复生成' : '内容没有保留在这里，可以主动换一个') }}</text>
      <button :disabled="busy" data-moment="recover" @click="emit('recover')" hover-class="moment-pressed">查看结果</button>
    </view>
  </view>
</template>

<style scoped lang="scss">
.bloom-moment { position:relative; padding:18px; border:1px solid var(--glass-border); border-radius:10px; background:linear-gradient(155deg,var(--glass-fill-a),var(--glass-fill-b)); color:var(--ink); box-shadow:var(--glass-inset),var(--glass-shadow); backdrop-filter:blur(20px); -webkit-backdrop-filter:blur(20px); }
.moment-edition { display:flex; justify-content:space-between; align-items:center; gap:10px; min-height:36px; padding-bottom:14px; font-size:12px; line-height:1.6; color:var(--muted); }
.moment-signature { display:flex; align-items:center; gap:8px; min-width:0; }
.moment-seed { width:7px; height:11px; flex:0 0 7px; border-radius:7px 1px 7px 1px; background:var(--accent); transform:rotate(25deg); box-shadow:0 0 12px var(--theme-glow); }
.moment-edition-meta { display:flex; align-items:center; justify-content:flex-end; gap:8px; flex-wrap:wrap; }
.bloom-moment .moment-toggle { min-height: 44px; padding: 0; gap: 3px; font-size: 13px; color: var(--muted); }
.moment-fold-icon { display: flex; transform: rotate(90deg); transition: transform 180ms ease; }
.moment-fold-icon.open { transform: rotate(-90deg); }
.is-collapsed .moment-heading { padding-bottom:18px; }
.moment-brand { font-family:var(--font-heading); font-size:16px; color:var(--ink); letter-spacing:.2px; white-space:nowrap; }
.moment-heading { display:flex; align-items:center; padding:19px 0 18px; }
.moment-heading-copy { flex: 1; min-width: 0; }
.moment-title { display:block; font-family:var(--font-heading); font-size:22px; font-weight:500; line-height:1.5; overflow-wrap:anywhere; }
.moment-intro { display:block; margin-top:8px; font-size:14px; line-height:1.8; color:var(--muted); white-space:pre-line; }
/* The photograph remains visible when the reading body is folded. */
.moment-picture { position:relative; width:100%; height:154px; overflow:hidden; border-radius:10px; background:var(--soft); box-shadow:inset 0 0 0 1px #ffffff14; }
.moment-image { display:block; width:100%; height:100%; background:var(--soft); }
.moment-picture-shade { position:absolute; inset:0; background:linear-gradient(180deg,#00000000 40%,#07111899 100%); pointer-events:none; }
.moment-picture-caption { position:absolute; left:14px; right:14px; bottom:12px; display:flex; align-items:center; gap:14px; color:#fff; font-size:12px; line-height:1.7; text-shadow:0 1px 5px #00000055; }
.moment-picture-line { flex:1; height:1px; background:#ffffff55; }
.moment-flavor { display: block; margin-bottom: 8px; font-size: 13px; color: var(--accent); line-height: 1.6; }
.moment-detail { padding-bottom:12px; transform-origin:top center; animation:moment-unfold 240ms cubic-bezier(.23,1,.32,1); }
.bloom-moment .moment-inline-fold { margin:8px 0 0 auto; padding:0; gap:5px; min-height:44px; width:max-content; font-size:13px; }
.moment-body { display:block; font-family:var(--font-body); font-size:var(--type-body); font-weight:400; line-height:1.8; white-space:pre-line; overflow-wrap:anywhere; }
.moment-question { display: flex; flex-wrap: wrap; margin-top: 16px; font-family: var(--font-heading); font-size: 18px; line-height: 1.7; color: var(--accent); overflow-wrap: anywhere; }
.moment-question > text { max-width: 100%; }
.moment-phrase { white-space: nowrap; }
.moment-source { margin-bottom: 18px; font-size: 14px; line-height: 1.8; }
.moment-source-date { display: block; margin-bottom: 6px; font-size: 13px; color: var(--muted); }
.moment-quote { display: block; color: var(--ink); }
.bloom-moment button { margin: 0; background: transparent; color: var(--muted); border: 0; border-radius: 6px; font-size: 14px; padding: 0 8px; min-height: 44px; display: flex; align-items: center; justify-content: center; gap: 10px; line-height: 1.5; transition: opacity 130ms, transform 130ms, background-color 130ms; }
.bloom-moment button::after { border: 0; }
.bloom-moment button[disabled] { opacity: .5; }
.moment-main-action { padding:4px 0 8px; display:flex; align-items:center; gap:16px; }
.moment-main-action > .moment-primary { flex:1; width:100%; justify-content:center; gap:14px; }
.bloom-moment .moment-primary {
  position:relative; min-width:118px; min-height:60px; padding:16px 22px; box-sizing:border-box; border-radius:10px;
  border:1px solid var(--nav-gem-hi-soft,#ffffff66);
  background:var(--bg); color:var(--ink);
  font-size:16px; font-weight:500; line-height:1.5; letter-spacing:.4px; text-shadow:none;
  box-shadow:0 0 0 1px var(--glass-chip),0 2px 10px var(--theme-glow),inset 0 1px 1px var(--nav-gem-hi-soft),inset 0 -1px 1px #00000018;
  transition:transform 160ms cubic-bezier(.23,1,.32,1),box-shadow 180ms ease,border-color 180ms ease,background-color 180ms ease;
}
.bloom-moment .moment-primary.moment-pressed, .bloom-moment .moment-primary:active:not([disabled]) {
  opacity:1; transform:translateY(1px) scale(.985);
  border-color:var(--nav-gem-hi);
  box-shadow:0 1px 6px var(--theme-glow),inset 0 1px 3px #00000026,inset 0 0 6px var(--glass-chip);
}
.bloom-moment .moment-primary:focus-visible { outline:2px solid var(--selection-border); outline-offset:4px; }
.bloom-moment .moment-primary[disabled] { background:var(--cta-disabled,var(--soft)); color:var(--muted); border-color:var(--line); text-shadow:none; box-shadow:none; transform:none; animation:none; }
@media (hover:hover) and (pointer:fine) {
  .bloom-moment .moment-primary:hover:not([disabled]):not(:active) {
    transform:translateY(-2px); border-color:var(--nav-gem-hi);
    box-shadow:0 0 0 1px var(--glass-chip-border),0 4px 18px var(--nav-gem-glow),inset 0 1px 1px var(--nav-gem-hi-soft),inset 0 -1px 1px #00000018;
  }
}
.moment-footnote { display: flex; align-items: center; gap: 8px; margin-top: 5px; }
.moment-human-note { flex: 1; min-width: 0; color: var(--muted); font-family: var(--font-heading); font-size: 14px; line-height: 1.8; }
.bloom-moment .moment-about { padding: 0; width: 32px; flex: 0 0 32px; min-height: 44px; }
.moment-secondary-actions { display: flex; justify-content: space-between; margin-top: 8px; }
.moment-secondary-actions button { padding-left: 0; padding-right: 0; }
.bloom-moment .moment-personalize { margin-top: 10px; justify-content: flex-start; width: 100%; padding: 0; gap: 8px; text-align: left; font-size: 13px; }
.moment-checkbox { width: 16px; height: 16px; flex: 0 0 16px; box-sizing: border-box; border: 1px solid var(--muted); border-radius: 6px; display: flex; align-items: center; justify-content: center; }
.moment-checkbox.checked { background: var(--soft); border-color: var(--accent); }
.moment-disclosure { display: block; margin-top: 8px; font-size: 13px; line-height: 1.65; color: var(--muted); }
.moment-notice { margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--line); color: var(--muted); font-size: 14px; line-height: 1.7; }
.moment-notice button { justify-content: flex-start; padding: 0; color: var(--accent); }
.moment-pending { font-size: 14px; color: var(--muted); }
.moment-consent { padding-top: 2px; font-size: 14px; line-height: 1.75; color: var(--muted); }
.moment-consent > text { display: block; margin-bottom: 10px; }
.moment-consent-title { color: var(--ink); }
.moment-consent-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
.moment-pressed { opacity:.76; transform:translateY(1px); }
.bloom-moment button { touch-action:manipulation; -webkit-tap-highlight-color:transparent; user-select:none; }
@keyframes moment-unfold { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:translateY(0); } }
@media (max-width: 360px) {
  .bloom-moment { padding:15px; }
  .moment-edition { align-items:center; }
  .moment-edition-meta { max-width:115px; gap:0 6px; }
  .moment-title { font-size:21px; }
  .moment-picture { height:140px; }
}
@media (prefers-reduced-motion: reduce) { .moment-fold-icon { transition:none; } .bloom-moment button { transition:none; } .bloom-moment .moment-primary:hover:not([disabled]):not(:active),.bloom-moment .moment-primary.moment-pressed,.bloom-moment .moment-primary:active:not([disabled]) { transform:none; } .moment-detail { animation:none; } .moment-pressed { transform:none; } }
</style>

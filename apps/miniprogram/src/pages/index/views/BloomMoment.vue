<script setup lang="ts">
import { computed, ref, watch, onUnmounted } from 'vue'
import SvgIcon from '../../../components/SvgIcon.vue'
import CompanionAvatar from '../../../components/CompanionAvatar.vue'
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
const expanded = ref(true), aboutOpen = ref(false)
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
      <text class="moment-brand">Bloom Moment</text>
      <view class="moment-edition-meta"><text>{{ dateLabel }}</text>
        <button class="moment-toggle" data-moment="toggle" :aria-expanded="expanded" aria-controls="moment-details"
                :aria-label="expanded ? '收起惊喜正文，仅显示标题' : '展开惊喜正文'" @click="expanded = !expanded" hover-class="moment-pressed" :hover-start-time="0">
          <text>{{ expanded ? '收起' : '展开' }}</text><view class="moment-fold-icon" :class="{ open: expanded }"><SvgIcon name="chevron" :size="14" tone="muted" /></view>
        </button>
      </view>
    </view>
    <view class="moment-heading">
      <view class="moment-heading-copy">
        <text v-if="expanded && content && content.kind !== 'light'" class="moment-flavor">{{ momentLabels[content.kind] }}</text>
        <text class="moment-title">{{ content?.title || (moment?.dismissed ? '那就让它轻轻过去' : '今天的一点惊喜') }}</text>
        <text v-if="expanded && !content" class="moment-intro">{{ moment?.dismissed ? '不需要解释\n也不急着找下一件事' : '不必先有问题\n为今天留一点意料之外' }}</text>
      </view>
      <view v-if="expanded && art && !artFailed" class="moment-picture" aria-hidden="true">
        <image :key="art.src" class="moment-image" :src="art.src" mode="aspectFill" @error="artFailed = true" />
      </view>
    </view>
    <view v-if="expanded" id="moment-details" class="moment-expanded">
    <view v-if="content" class="moment-detail" :key="moment?.id">
      <view v-for="source in content.sources" :key="source.id" class="moment-source">
        <text class="moment-source-date">你在 {{ source.date }} 确认过 · 现在可以不同</text>
        <text class="moment-quote">「{{ source.quote }}」</text>
      </view>
      <text class="moment-body">{{ content.invitation }}</text>
      <view class="moment-question"><text v-for="(phrase, index) in questionPhrases" :key="index" :class="{ 'moment-phrase': phrase.keepTogether }">{{ phrase.value }}</text></view>
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
        <button v-if="!content && !moment" class="moment-primary" data-moment="open" :disabled="busy" @click="emit('open', false)" hover-class="moment-pressed" :hover-start-time="0">
          <text>{{ generating ? '正在准备' : loading ? '正在查看' : '拆开看看' }}</text><SvgIcon name="arrow" :size="17" :light="true" />
        </button>
        <button v-else-if="content" class="moment-primary" data-moment="chat" :disabled="busy" @click="emit('chat')" hover-class="moment-pressed" :hover-start-time="0">
          <text>聊聊这个</text><SvgIcon name="arrow" :size="17" :light="true" />
        </button>
        <button v-else-if="moment?.status !== 'pending'" class="moment-primary" data-moment="another" :disabled="busy" @click="emit('open', true)" hover-class="moment-pressed" :hover-start-time="0">{{ generating ? '正在准备' : '再来一个' }}</button>
        <view v-else class="moment-pending" role="status">小惊喜还在准备</view>
        <CompanionAvatar :size="46" :online="false" :follow-gaze="true" :foreground="foreground" :state="generating ? 'thinking' : arrived ? 'speaking' : 'rest'" />
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
    </view>
    <view v-if="error || moment?.status === 'pending' || (moment && !content && !moment.dismissed)" class="moment-notice" data-moment="notice" role="status">
      <text>{{ error || (moment?.status === 'pending' ? '稍后可以查看，不会重复生成' : '内容没有保留在这里，可以主动换一个') }}</text>
      <button :disabled="busy" data-moment="recover" @click="emit('recover')" hover-class="moment-pressed">查看结果</button>
    </view>
  </view>
</template>

<style scoped lang="scss">
.bloom-moment { padding: 18px 20px 16px; border: 1px solid var(--line); border-radius: 8px; background: var(--paper); color: var(--ink); box-shadow: 0 4px 18px #00000004; }
.moment-edition { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; padding-bottom: 15px; border-bottom: 1px solid var(--line); font-size: 13px; line-height: 1.5; color: var(--muted); }
.moment-edition-meta { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.bloom-moment .moment-toggle { min-height: 44px; padding: 0; gap: 3px; font-size: 13px; color: var(--muted); }
.moment-fold-icon { display: flex; transform: rotate(90deg); transition: transform 180ms ease; }
.moment-fold-icon.open { transform: rotate(-90deg); }
.is-collapsed .moment-heading { padding-bottom: 4px; }
.moment-brand { font-family: var(--font-heading); font-size: 15px; color: var(--accent); letter-spacing: .3px; }
.moment-heading { display: flex; align-items: center; gap: 16px; padding: 22px 0 20px; }
.moment-heading-copy { flex: 1; min-width: 0; }
.moment-title { display:block; font-family:var(--font-heading); font-size:var(--type-section); font-weight:500; line-height:1.5; overflow-wrap:anywhere; }
.moment-intro { display: block; margin-top: 10px; font-size: 14px; line-height: 1.8; color: var(--muted); white-space: pre-line; }
/* A small photograph, bounded independently of any generated text length. */
.moment-picture { flex: 0 0 76px; width: 76px; height: 94px; box-sizing: border-box; padding: 4px; background: var(--paper); border: 1px solid var(--line); border-radius: 6px; transform: rotate(3deg); }
.moment-image { display: block; width: 100%; height: 100%; border-radius: 6px; background: var(--soft); }
.moment-flavor { display: block; margin-bottom: 8px; font-size: 13px; color: var(--accent); line-height: 1.6; }
.moment-detail { padding-bottom: 20px; }
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
.moment-main-action { padding-bottom: 3px; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.bloom-moment .moment-primary {
  position: relative; min-width: 118px; min-height: 48px; padding: 0 18px; box-sizing: border-box; border-radius: 8px;
  border: 1px solid var(--nav-gem-hi-soft, #ffffff66);
  background: linear-gradient(150deg, var(--cta-highlight) 0%, var(--button-fill) 48%, var(--cta-deep) 100%);
  color: var(--cta-ink, #fff); font-weight: 500; text-shadow: 0 1px 2px #14231a38;
  box-shadow: 0 1px 2px #1020171a, 0 3px 8px var(--theme-glow), inset 0 1px 1px #ffffff59, inset 0 -1px 2px #1020171a;
  transition: transform 130ms, box-shadow 130ms;
}
.bloom-moment .moment-primary.moment-pressed, .bloom-moment .moment-primary:active:not([disabled]) {
  opacity: 1; transform: translateY(1px);
  box-shadow: 0 1px 3px var(--theme-glow), inset 0 1px 2px #10201726;
}
.bloom-moment .moment-primary[disabled] { background: var(--cta-disabled, var(--soft)); color: var(--muted); border-color: var(--line); text-shadow: none; box-shadow: none; transform: none; }
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
.moment-pressed { opacity: .76; transform: translateY(1px); }
.is-arriving .moment-detail { animation: moment-unfold 220ms ease-out; }
@keyframes moment-unfold { from { opacity: .45; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
@media (max-width: 360px) {
  .bloom-moment { padding: 16px; }
  .moment-heading { gap: 12px; }
  .moment-title { font-size:var(--type-section); }
  .moment-picture { flex-basis: 62px; width: 62px; height: 80px; }
}
@media (prefers-reduced-motion: reduce) { .moment-fold-icon { transition: none; } .bloom-moment button { transition: none; } .is-arriving .moment-detail { animation: none; } .moment-pressed { transform: none; } }
</style>

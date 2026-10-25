<script setup lang="ts">
import { computed, ref } from 'vue'
import SvgIcon from '../../../components/SvgIcon.vue'
import { resolveVisual } from '../../../visual-library'

defineOptions({ options: { styleIsolation: 'apply-shared' } })
const props = defineProps<{ themeId: string }>()
const opened = ref('')
// Editorial reading is separate from personal recommendations and never enters user context.
const articles = [
  {
    id: 'thoughts', category: 'reflection' as const, label: '认识想法', title: '想法和事实，可以分开看',
    intro: '同一件事，有时不止一种解释。先留一点空白，不急着下结论',
    body: '我们对一件事的解释，会影响当下的感受。把已经发生的事和自己的理解分开，有时能看见其他可能。感受仍然值得被认真对待，也不需要强迫自己往好处想',
    example: '例如：「发出的消息还没收到回复」是观察；「对方一定不在意我」是一种解释。还有哪些信息没有得到？',
    invitation: '如果愿意，可以写下：我知道的事实、我想到的解释、我还不知道的部分',
    source: 'Psychology Tools · Thoughts in CBT', url: 'https://www.psychologytools.com/self-help/thoughts-in-cbt',
  },
  {
    id: 'kindness', category: 'rest' as const, label: '自我关怀', title: '把对朋友的语气，也留一点给自己',
    intro: '遇到不顺时，可以诚实地看待困难，也给自己一点温和',
    body: '自我关怀的一种练习，是留意自己如何谈论失误，再试着用更理解、更有支持感的语言回应。承认事情做得不如预期，与否定整个人，是不同的表达',
    example: '例如，把「我怎么总是做不好」改成「这次没有达到期待，我有些失望。接下来哪一部分需要帮助？」',
    invitation: '如果愿意，想想朋友遇到同样的事时，你会怎样和他说话。挑一句你也愿意听到的话',
    source: 'Self-Compassion Institute · Changing your critical self-talk', url: 'https://self-compassion.org/exercises/exercise-5-changing-your-critical-self-talk/',
  },
]
const cards = computed(() => articles.map(article => ({ ...article, image: resolveVisual({ page: 'shared', category: article.category }, props.themeId, 'card-thumbnail')?.src || (article.category === 'rest' ? '/static/visuals/rest/rest_bluebell_forest_01.jpg' : '/static/visuals/reflection/reflection_sunlit_window_book_01.jpg') })))
function copySource(url: string) {
  uni.setClipboardData({ data: url, success: () => uni.showToast({ title: '来源链接已复制', icon: 'none' }), fail: () => uni.showToast({ title: '暂时无法复制，请稍后重试', icon: 'none' }) })
}
</script>

<template>
  <view class="discover-reading">
    <view class="reading-section"><text class="reading-heading">一点心理学，慢慢读</text><text class="reading-caption">通用心理学读物 · 不基于你的个人记录</text></view>
    <view v-for="article in cards" :key="article.id" class="reading-card">
      <button class="reading-cover" :aria-expanded="opened === article.id" @click="opened = opened === article.id ? '' : article.id" hover-class="pressed">
        <image class="reading-image" :src="article.image" mode="aspectFill" aria-hidden="true" />
        <view class="reading-copy"><text class="reading-label">{{ article.label }}</text><text class="reading-title">{{ article.title }}</text><text class="reading-intro">{{ article.intro }}</text><view class="reading-open"><text>{{ opened === article.id ? '收起正文' : '读一读' }}</text><SvgIcon name="chevron" :size="16" tone="accent" /></view></view>
      </button>
      <view v-if="opened === article.id" class="reading-body">
        <text>{{ article.body }}</text><text class="reading-example">{{ article.example }}</text><text>{{ article.invitation }}</text>
        <text class="reading-credit">参考资料：{{ article.source }} · 编辑整理</text>
        <button class="reading-source" @click="copySource(article.url)" hover-class="pressed">复制来源链接</button>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.reading-section { margin:4px 0 16px; }
.reading-heading { display:block; font-family:var(--font-heading); font-size:19px; color:var(--ink); line-height:1.6; }
.reading-caption { display:block; margin-top:5px; color:var(--muted); font-size:12px; line-height:1.7; }
.reading-card { margin-bottom:18px; overflow:hidden; border:1px solid var(--glass-border); border-radius:10px; background:linear-gradient(145deg,var(--glass-fill-a),var(--glass-fill-b)); box-shadow:var(--glass-inset),0 8px 24px #0000000a; backdrop-filter:blur(18px); -webkit-backdrop-filter:blur(18px); }
.reading-cover { display:block; width:100%; padding:0; margin:0; background:transparent; text-align:left; color:var(--ink); border:0; border-radius:0; line-height:1.7; }
.reading-cover::after,.reading-source::after { border:0; }
.reading-image { display:block; width:100%; height:150px; background:var(--soft); }
.reading-copy { padding:16px; }
.reading-label { display:block; color:var(--accent); font-size:12px; }
.reading-title { display:block; margin-top:6px; font-family:var(--font-heading); font-size:20px; line-height:1.6; }
.reading-intro { display:block; margin-top:8px; font-size:14px; color:var(--muted); line-height:1.85; }
.reading-open { display:flex; align-items:center; gap:8px; padding-top:12px; font-size:13px; color:var(--accent); }
.reading-body { padding:0 16px 12px; font-size:14px; line-height:1.9; color:var(--ink); }
.reading-body > text { display:block; margin-bottom:14px; }
.reading-example { background:var(--soft); border-radius:6px; padding:12px; }
.reading-body .reading-credit { margin-bottom:0; font-size:11px; color:var(--muted); overflow-wrap:anywhere; }
.reading-source { display:flex; align-items:center; min-height:44px; margin:0; padding:0; background:transparent; font-size:12px; color:var(--accent); text-align:left; }
</style>

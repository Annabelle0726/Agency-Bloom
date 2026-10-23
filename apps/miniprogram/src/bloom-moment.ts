import { ref, watch, type Ref } from 'vue'
import type { User } from './domain'
import { resolveVisual, visuals, type VisualCategory } from './visual-library'

export type MomentKind = 'perspective' | 'experiment' | 'echo' | 'light'
export interface MomentContent {
  kind: MomentKind; title: string; invitation: string; question: string
  sources: Array<{ id: string; quote: string; date: string; version: number }>
}
export interface Moment {
  id: string; status: string; content: MomentContent | null; dismissed: boolean; demo: boolean
}
interface Today { day: string; moment: Moment | null }
type Request = <T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, data?: unknown) => Promise<T>
export const momentLabels: Record<MomentKind, string> = {
  perspective: '意外的新视角', experiment: '小小的生活实验', echo: '来自过去的回声', light: '纯粹的轻盈时刻',
}
export function momentDraft(content: MomentContent) {
  // Quoted AI material is explicitly labelled, never promoted to user biography.
  const quote = content.sources.map(s => `我曾确认的记录（${s.date}，现在可能不同）：「${s.quote}」`).join('\n')
  return `想聊聊这份 Bloom Moment\n${quote ? quote + '\n' : ''}AI 给出的邀请（不是我的经历）：${content.invitation}\n${content.question}\n`
}
export function momentVisual(kind: MomentKind, theme: string, day: string, id = '') {
  const category: Record<MomentKind, VisualCategory> = { perspective: 'direction', experiment: 'growth', echo: 'reflection', light: 'rest' }
  const choices = visuals.filter(v => v.category === category[kind] && v.intendedPage.includes('shared') && v.themeCompatibility.includes(theme as any) && v.deploy)
  let hash = 0
  for (const c of day + id) hash = (Math.imul(hash, 31) + c.charCodeAt(0)) >>> 0
  const preferred = choices.length ? [choices[hash % choices.length].id] : []
  return resolveVisual({ page: 'shared', category: category[kind], preferredIds: preferred }, theme, 'card-thumbnail')
    || resolveVisual({ page: 'shared', tags: ['quiet', 'reflection'] }, theme, 'card-thumbnail')
}

export function useBloomMoment(user: Ref<User | null>, request: Request, requestId: () => string) {
  const moment = ref<Moment | null>(null), day = ref(''), loading = ref(false), generating = ref(false)
  const error = ref(''), loaded = ref(false), personalize = ref(false), consentOpen = ref(false)
  let epoch = 0
  watch(() => [user.value?.id, user.value?.ai_consent, user.value?.save_chat, user.value?.use_memory], () => {
    epoch++; moment.value = null; day.value = ''; loading.value = false; generating.value = false
    error.value = ''; loaded.value = false; personalize.value = false; consentOpen.value = false
  }, { flush: 'sync' })
  const message = (err: unknown) => err instanceof Error ? err.message : '这份小惊喜暂时没有准备好'
  async function load() {
    if (!user.value || loading.value || generating.value) return false
    const run = epoch; loading.value = true; error.value = ''
    try {
      const result = await request<Today>('GET', '/moments/today')
      if (run !== epoch) return false
      // Retention-off content may remain in this session, but not after a refusal.
      const ephemeral = moment.value
      moment.value = result.moment
      if (!user.value.save_chat && ephemeral?.id === result.moment?.id && !result.moment?.dismissed) moment.value = ephemeral
      day.value = result.day; loaded.value = true
      return true
    } catch (err) { if (run === epoch) error.value = message(err); return false }
    finally { if (run === epoch) loading.value = false }
  }
  async function open(another = false) {
    if (!user.value || generating.value || loading.value) return
    if (!user.value.ai_consent) { consentOpen.value = true; return }
    // Reconcile daily slot before every explicit generation; never retry POST.
    if (!await load()) return
    if (!another && moment.value) return
    const previous = moment.value
    if (previous?.status === 'pending') return
    another = another && !!previous
    const run = epoch; generating.value = true; error.value = ''
    try {
      const result = await request<Today>('POST', '/moments/open', {
        request_id: requestId(), action: another ? 'another' : 'open', previous_id: previous?.id || null,
        personalize: personalize.value && !!user.value.use_memory,
      })
      if (run !== epoch) return
      moment.value = result.moment; day.value = result.day
      if (result.moment && !result.moment.content) error.value = result.moment.status === 'pending'
        ? '还在准备中，可以稍后查看结果' : '这次没有形成合适的小惊喜，可以主动换一个'
    } catch (err) { if (run === epoch) { error.value = message(err); loaded.value = false } }
    finally { if (run === epoch) generating.value = false }
  }
  async function consent() {
    if (!user.value || loading.value) return
    const run = epoch; loading.value = true
    try {
      const result = await request<User>('PUT', '/me', { ai_consent: true })
      if (run !== epoch) return
      user.value = result; consentOpen.value = false
      await open()
    } catch (err) { if (run === epoch) error.value = message(err) }
    finally { if (run === epoch) loading.value = false }
  }
  async function dismiss() {
    if (!moment.value || generating.value || loading.value) return
    const item = moment.value, run = epoch; loading.value = true; error.value = ''
    try {
      await request('POST', `/moments/${item.id}/dismiss`)
      if (run === epoch && moment.value?.id === item.id) moment.value = { ...item, content: null, dismissed: true }
    } catch (err) { if (run === epoch) error.value = message(err) }
    finally { if (run === epoch) loading.value = false }
  }
  return { moment, day, loading, generating, error, loaded, personalize, consentOpen, load, open, consent, dismiss }
}

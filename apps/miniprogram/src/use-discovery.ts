import { computed, reactive, ref, watch, type Ref } from 'vue'
import type { Issue, User } from './domain'
import type { JourneyPage, JourneyEvent } from './journey'
import { discoveryStateKey, emptyDiscoveryState, readDiscoveryState, recordDiscoveryFeedback, selectDiscovery } from './discovery'
import { relevantAngles, type DiscoveryAngle } from './discover-angles'

export function useDiscovery(user: Ref<User | null>, request: <T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, data?: unknown) => Promise<T>, notify: (message: string) => void, current?: Ref<Issue | null>) {
  const issues = ref<Issue[]>([]), events = ref<JourneyEvent[]>([])
  const state = ref(emptyDiscoveryState()), loading = ref(false), error = ref(''), loaded = ref(false)
  const focusId = ref<string | null>(current?.value?.id || null)
  const recommendations = ref<DiscoveryAngle[]>([])
  const scrollTop = ref(0)
  const ui = reactive({ expanded: '', source: '', momentOpen: false, picker: false })
  let generation = 0
  const batches = new Map<string, string[]>()
  const focus = computed(() => issues.value.find(i => i.id === focusId.value && !i.ended_at) || null)
  const candidates = computed(() => focus.value ? relevantAngles(focus.value, events.value) : [])
  const available = computed(() => selectDiscovery(candidates.value, state.value, Date.now(), 100) as DiscoveryAngle[])
  const canRotate = computed(() => available.value.some(a => !recommendations.value.some(r => r.id === a.id)))
  const emptyReason = computed(() => !candidates.value.length ? 'no-evidence' : 'exhausted')
  function persist() {
    if (!user.value) return
    try { uni.setStorageSync(discoveryStateKey(user.value.id), state.value) }
    catch { notify('这次选择暂时只保留在当前使用期间') }
  }
  function reconcile() {
    const key = focusId.value || '', previous = batches.get(key)
    recommendations.value = previous ? previous.map(id => available.value.find(c => c.id === id)).filter((c): c is DiscoveryAngle => !!c) : available.value.slice(0, 3)
    if (previous && previous.length > recommendations.value.length) {
      const replacements = available.value.filter(c => !previous.includes(c.id))
      recommendations.value.push(...replacements.slice(0, previous.length - recommendations.value.length))
    }
    batches.set(key, recommendations.value.map(c => c.id))
  }
  watch(() => user.value?.id, id => {
    generation++; issues.value = []; events.value = []; recommendations.value = []
    loaded.value = false; loading.value = false; error.value = ''; batches.clear()
    scrollTop.value = 0; Object.assign(ui, { expanded: '', source: '', momentOpen: false, picker: false })
    focusId.value = current?.value?.id || null
    try { state.value = id ? readDiscoveryState(uni.getStorageSync(discoveryStateKey(id))) : emptyDiscoveryState() }
    catch { state.value = emptyDiscoveryState() }
  }, { immediate: true, flush: 'sync' })
  watch(() => current?.value?.id, id => { if (id !== undefined) chooseFocus(id || null) })
  function chooseFocus(id: string | null) {
    if (id !== focusId.value) { scrollTop.value = 0; ui.expanded = ''; ui.source = '' }
    focusId.value = id
    if (loaded.value) reconcile()
  }
  async function load() {
    if (!user.value) return
    const account = user.value.id, run = ++generation
    loading.value = true; error.value = ''
    try {
      const all: Issue[] = []
      for (let offset = 0; ; offset += 100) {
        const page = await request<Issue[]>('GET', '/issues?limit=100&offset=' + offset)
        all.push(...page)
        if (page.length < 100) break
      }
      if (run !== generation || user.value?.id !== account) return
      issues.value = all; events.value = []
      // Remove withdrawn source material before an independent history request.
      recommendations.value = recommendations.value.filter(c => candidates.value.some(a => a.id === c.id))
      const history = await request<JourneyPage>('GET', '/journey/events?limit=100')
      if (run !== generation || user.value?.id !== account) return
      events.value = history.items
      reconcile(); loaded.value = true
    } catch (err) {
      if (run === generation && user.value?.id === account) {
        recommendations.value = []; issues.value = []; events.value = []
        error.value = err instanceof Error ? err.message : '暂时无法读取你保存的线索'
      }
    } finally { if (run === generation) loading.value = false }
  }
  function dismiss(item: DiscoveryAngle) {
    if (loading.value || !recommendations.value.some(r => r.id === item.id)) return
    state.value = recordDiscoveryFeedback(state.value, item, 'dismissed', Date.now())
    recommendations.value = recommendations.value.filter(r => r.id !== item.id)
    batches.set(focusId.value || '', recommendations.value.map(c => c.id)); persist()
    notify('这个角度先放一放')
  }
  function explored(item: import('./discovery').DiscoveryRecommendation) {
    state.value = recordDiscoveryFeedback(state.value, item, 'explored', Date.now()); persist()
  }
  function rotate() {
    if (loading.value || !loaded.value || !canRotate.value) return
    recommendations.value = available.value.filter(c => !recommendations.value.some(r => r.id === c.id)).slice(0, 3)
    batches.set(focusId.value || '', recommendations.value.map(c => c.id))
  }
  async function verify(item: DiscoveryAngle) {
    if (!user.value || !item.issueId) return null
    const account = user.value.id
    const issue = await request<Issue>('GET', '/issues/' + item.issueId)
    const history = item.strategy === 'observation' ? await request<JourneyPage>('GET', '/journey/events?limit=100') : { items: [] }
    if (user.value?.id !== account) return null
    return relevantAngles(issue, history.items).find(a => a.id === item.id) || null
  }
  return { issues, focusId, focus, recommendations, loading, error, loaded, canRotate, emptyReason, chooseFocus, load, dismiss, explored, rotate, verify, scrollTop, ui }
}

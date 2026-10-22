import { computed, ref, watch, type Ref } from 'vue'
import type { Issue, User } from './domain'
import type { JourneyPage, JourneyEvent } from './journey'
import { discoveryBatch, discoveryCandidates, discoveryStateKey, emptyDiscoveryState, readDiscoveryState, recordDiscoveryFeedback } from './discovery'
import type { DiscoveryRecommendation } from './discovery'

export function useDiscovery(user: Ref<User | null>, request: <T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, data?: unknown) => Promise<T>, notify: (message: string) => void) {
  const issues = ref<Issue[]>([]), events = ref<JourneyEvent[]>([])
  const state = ref(emptyDiscoveryState()), loading = ref(false), error = ref(''), loaded = ref(false), checkedAt = ref(Date.now())
  const recommendations = ref<DiscoveryRecommendation[]>([]), swaps = ref(0)
  let generation = 0, sourceKey = '', seen: string[] = [], loginPrevious: string[] = []
  function persist() {
    if (!user.value) return
    try { uni.setStorageSync(discoveryStateKey(user.value.id), state.value) }
    catch { notify('这次选择会在当前使用期间保留，暂时未能存到本机') }
  }
  watch(() => user.value?.id, id => {
    generation++; issues.value = []; events.value = []; loaded.value = false; loading.value = false; error.value = ''
    recommendations.value = []; sourceKey = ''; seen = []; swaps.value = 0
    try { state.value = id ? readDiscoveryState(uni.getStorageSync(discoveryStateKey(id))) : emptyDiscoveryState() }
    catch { state.value = emptyDiscoveryState() }
    loginPrevious = state.value.lastShown || []
    // An authenticated session/restore refreshes once; tab visits and profile
    // updates never advance this round. Existing refusals remain account scoped.
    if (id) { state.value.round = (state.value.round + 1) % 1000000; persist() }
  }, { immediate: true, flush: 'sync' })
  const candidates = computed(() => discoveryCandidates(issues.value, events.value))
  function remember() {
    state.value.lastShown = recommendations.value.map(c => c.id)
    persist()
  }
  function replaceBatch(exclude: string[]) {
    recommendations.value = discoveryBatch(candidates.value, state.value, checkedAt.value, exclude, swaps.value >= 3)
    remember()
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
      // Confirmed records only; no pending insights or conversations.
      const history = await request<JourneyPage>('GET', '/journey/events?limit=100')
      if (run !== generation || user.value?.id !== account) return
      issues.value = all; events.value = history.items; checkedAt.value = Date.now()
      const nextKey = JSON.stringify(candidates.value)
      if (!loaded.value || nextKey !== sourceKey) {
        replaceBatch(!loaded.value ? loginPrevious : [])
        sourceKey = nextKey
      }
      loaded.value = true
    } catch (err) {
      if (run === generation && user.value?.id === account) error.value = err instanceof Error ? err.message : '暂时无法读取你保存的线索'
    } finally { if (run === generation) loading.value = false }
  }
  function dismiss(item: DiscoveryRecommendation) {
    if (loading.value || item.strategy === 'self' || !recommendations.value.some(r => r.id === item.id)) return
    state.value = recordDiscoveryFeedback(state.value, item, 'dismissed', Date.now())
    // Replace only this card, keeping the other visible choices in place.
    const keep = recommendations.value.filter(r => r.id !== item.id)
    const replacement = discoveryBatch(candidates.value, state.value, checkedAt.value, [...seen, ...recommendations.value.map(c => c.id)])
      .find(c => !keep.some(k => k.id === c.id))
    recommendations.value = recommendations.value.flatMap(c => c.id === item.id ? replacement ? [replacement] : [] : [c])
    remember()
    notify('已换一个问题，其他卡片会保留')
  }
  function explored(item: DiscoveryRecommendation) {
    if (item.strategy === 'self') return
    state.value = recordDiscoveryFeedback(state.value, item, 'explored', Date.now())
    replaceBatch(recommendations.value.map(c => c.id))
  }
  function rotate() {
    if (loading.value || !loaded.value) return
    seen = [...new Set([...seen, ...recommendations.value.map(c => c.id)])].slice(-200)
    swaps.value = Math.min(3, swaps.value + 1)
    state.value.round = (state.value.round + 1) % 1000000
    replaceBatch(seen)
  }
  return { issues, recommendations, loading, error, loaded, load, dismiss, explored, rotate }
}

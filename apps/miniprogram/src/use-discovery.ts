import { computed, ref, watch, type Ref } from 'vue'
import type { Issue, User } from './domain'
import type { JourneyPage, JourneyEvent } from './journey'
import { discoveryCandidates, discoveryStateKey, emptyDiscoveryState, readDiscoveryState, recordDiscoveryFeedback, selectDiscovery } from './discovery'
import type { DiscoveryRecommendation } from './discovery'

export function useDiscovery(user: Ref<User | null>, request: <T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, data?: unknown) => Promise<T>, notify: (message: string) => void) {
  const issues = ref<Issue[]>([]), events = ref<JourneyEvent[]>([])
  const state = ref(emptyDiscoveryState()), loading = ref(false), error = ref(''), loaded = ref(false), checkedAt = ref(Date.now())
  let generation = 0
  watch(() => user.value?.id, id => {
    generation++; issues.value = []; events.value = []; loaded.value = false; loading.value = false; error.value = ''
    try { state.value = id ? readDiscoveryState(uni.getStorageSync(discoveryStateKey(id))) : emptyDiscoveryState() }
    catch { state.value = emptyDiscoveryState() }
  }, { immediate: true })
  const candidates = computed(() => discoveryCandidates(issues.value, events.value))
  const recommendations = computed(() => loaded.value ? selectDiscovery(candidates.value, state.value, checkedAt.value, 2) : [])
  function persist() {
    if (!user.value) return
    try { uni.setStorageSync(discoveryStateKey(user.value.id), state.value) }
    catch { notify('这次选择会在当前使用期间保留，暂时未能存到本机') }
  }
  async function load() {
    if (!user.value) return
    const account = user.value.id, run = ++generation
    loading.value = true; error.value = ''; loaded.value = false
    try {
      const all: Issue[] = []
      for (let offset = 0; ; offset += 100) {
        const page = await request<Issue[]>('GET', '/issues?limit=100&offset=' + offset)
        all.push(...page)
        if (page.length < 100) break
      }
      // This endpoint returns confirmed records only. Pending AI insights and
      // conversations are never requested by Discovery.
      const history = await request<JourneyPage>('GET', '/journey/events?limit=100')
      if (run !== generation || user.value?.id !== account) return
      issues.value = all; events.value = history.items; checkedAt.value = Date.now(); loaded.value = true
    } catch (err) {
      if (run === generation && user.value?.id === account) error.value = err instanceof Error ? err.message : '暂时无法读取你保存的线索'
    } finally { if (run === generation) loading.value = false }
  }
  function dismiss(item: DiscoveryRecommendation) {
    if (!recommendations.value.some(r => r.id === item.id)) return
    state.value = recordDiscoveryFeedback(state.value, item, 'dismissed', Date.now()); persist()
    notify('会减少这类问题的重复，不必说明原因')
  }
  function explored(item: DiscoveryRecommendation) {
    state.value = recordDiscoveryFeedback(state.value, item, 'explored', Date.now()); persist()
  }
  function rotate() {
    const before = recommendations.value.map(r => r.id).sort().join('|')
    for (let step = 1; step <= candidates.value.length; step++) {
      const next = { ...state.value, round: state.value.round + step }
      if (selectDiscovery(candidates.value, next, checkedAt.value, 2).map(r => r.id).sort().join('|') !== before) {
        state.value = next; persist(); return
      }
    }
    notify('暂时没有更相关的问题，先留住眼前这些也好')
  }
  return { issues, recommendations, loading, error, loaded, load, dismiss, explored, rotate }
}

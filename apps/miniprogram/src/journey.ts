import { onHide } from '@dcloudio/uni-app'
import { computed, onUnmounted, provide, ref, watch } from 'vue'
import { createApi } from './http'
import { ICON_PALETTE_KEY } from './icon-system'
import { resolveTheme, themeStyle } from './themes'
import { createThemePreference, personalSpaceTheme } from './theme-preference'
import { createThemeClock } from './theme-clock'
import type { Issue, User } from './domain'

export interface JourneyEvent {
  id: string; issue_id: string; issue_title: string; kind: string; title: string
  text: string; created_at: string; version?: string; editable: boolean
  source_label: string; source_available: boolean; source_text?: string
}
export interface JourneyCandidate {
  id: string; issue_id: string; title: string; text: string
  uncertainty: string; created_at: string; source_version: string
}
export interface JourneyPage { items: JourneyEvent[]; next_cursor: string | null }
export interface CandidatePage { items: JourneyCandidate[]; next_offset: number | null }

// Dates are interpreted in the product's Shanghai time zone, including older UTC records.
export function journeyDate(value: string) {
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) return '日期未记录'
  const date = new Date(parsed + 8 * 60 * 60 * 1000)
  return `${date.getUTCFullYear()}年${date.getUTCMonth() + 1}月${date.getUTCDate()}日`
}
export function shortJourneyDate(value: string) { return journeyDate(value).replace(/^\d+年/, '') }
export function mergeJourneyEvents(existing: JourneyEvent[], incoming: JourneyEvent[]) {
  const byId = new Map(existing.map(item => [item.id, item]))
  incoming.forEach(item => byId.set(item.id, item))
  return [...byId.values()].sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id))
}
export function reflectionFor(events: JourneyEvent[], issues: Issue[]) {
  // Quote the user's record; never turn the current card into an invented past.
  const latest = events.find(item => item.kind !== 'start' && item.kind !== 'end')
  const start = latest && events.find(item => item.kind === 'start' && item.issue_id === latest.issue_id)
  const issue = latest && issues.find(item => item.id === latest.issue_id)
  if (!latest || !issue) return null
  return { introduction: start ? `从「${start.text}」开始，你留下了这段记录` : `在「${issue.title || '这段探索'}」里，你最近留下了这段记录`,
    quote: latest.text.length > 140 ? latest.text.slice(0, 140) + '…' : latest.text, date: journeyDate(latest.created_at) }
}
export function useJourneySession() {
  const user = ref<User | null>(null), error = ref(''), loading = ref(false)
  const entryTheme = ref(resolveTheme('light'))
  const preference = createThemePreference({
    read: key => uni.getStorageSync(key),
    write: (key, value) => uni.setStorageSync(key, value),
    remove: key => uni.removeStorageSync(key),
  })
  const clock = createThemeClock()
  clock.start()
  const keyboardHeight = ref(0)
  // #ifdef MP-WEIXIN
  const keyboardChanged = ({ height }: { height: number }) => { keyboardHeight.value = height }
  uni.onKeyboardHeightChange(keyboardChanged)
  onUnmounted(() => uni.offKeyboardHeightChange(keyboardChanged))
  // #endif
  onUnmounted(clock.stop)
  onHide(() => { clock.stop(); keyboardHeight.value = 0 })
  const auto = computed(() => !user.value || preference.isAuto(user.value.id))
  const override = computed(() => user.value ? preference.overrideFor(user.value.id, clock.slot.value.key) : null)
  const desiredTheme = computed(() => user.value
    ? personalSpaceTheme(user.value, { auto: auto.value, overrideTheme: override.value, slot: clock.slot.value })
    : entryTheme.value)
  const activeThemeId = ref(desiredTheme.value.id)
  const theme = computed(() => resolveTheme(activeThemeId.value))
  watch([() => desiredTheme.value.id, keyboardHeight], () => {
    // Keep a focused journey form readable across a time boundary.
    if (keyboardHeight.value === 0) activeThemeId.value = desiredTheme.value.id
  }, { immediate: true })
  watch(() => user.value?.id, () => { activeThemeId.value = desiredTheme.value.id })
  watch([() => user.value?.id, () => clock.slot.value.key], ([id, slot]) => {
    if (id) preference.pruneOverride(id, slot)
  }, { immediate: true })
  function setEntryTheme(value?: string) { entryTheme.value = resolveTheme(value) }
  function refreshTheme() { clock.refresh(); clock.start() }
  const style = computed(() => themeStyle(theme.value))
  const system = uni.getSystemInfoSync()
  let capsuleBottom = (system.statusBarHeight || 20) + 44
  // #ifdef MP-WEIXIN
  try { capsuleBottom = uni.getMenuButtonBoundingClientRect().bottom } catch { /* System fallback. */ }
  // #endif
  watch(theme, value => {
    uni.setNavigationBarColor({ frontColor: value.dark ? '#ffffff' : '#000000', backgroundColor: value.palette.bg })
  }, { immediate: true })
  provide(ICON_PALETTE_KEY, computed(() => theme.value.palette))
  const api = createApi(options => uni.request(options), () => uni.getStorageSync('agency.session') || '',
    () => { user.value = null; error.value = '登录已失效，请返回后重新登录' },
    import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api')
  async function request<T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, data?: unknown) {
    return api.request<T>(method, path, data).promise
  }
  async function loadSession() { user.value = await request<User>('GET', '/me') }
  function back() {
    if (getCurrentPages().length > 1) uni.navigateBack()
    else uni.reLaunch({ url: '/pages/index/index' })
  }
  return { user, theme, style, error, loading, capsuleBottom, request, loadSession, setEntryTheme, refreshTheme, back }
}

import { computed, ref } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import { themeSlotAt } from './theme-preference'
import type { ThemeSlot } from './theme-preference'

export type ThemeTimer = ReturnType<typeof setTimeout>

export interface ThemeClock {
  now: Ref<number>
  slot: ComputedRef<ThemeSlot>
  refresh: () => void
  start: () => void
  stop: () => void
}

export interface ThemeClockOptions {
  now?: () => number
  setTimer?: (callback: () => void, delay: number) => ThemeTimer
  clearTimer?: (timer: ThemeTimer) => void
}

// A small grace period avoids waking just before the boundary on slower timers.
const BOUNDARY_GRACE_MS = 250

export function createThemeClock(options: ThemeClockOptions = {}): ThemeClock {
  const readNow = options.now || (() => Date.now())
  const setTimer = options.setTimer || ((callback, delay) => setTimeout(callback, delay))
  const clearTimer = options.clearTimer || (timer => clearTimeout(timer))
  const now = ref(readNow())
  const slot = computed(() => themeSlotAt(now.value))
  let timer: ThemeTimer | undefined
  let running = false

  function cancel() {
    if (timer === undefined) return
    clearTimer(timer)
    timer = undefined
  }

  function schedule() {
    cancel()
    if (!running) return
    const delay = Math.max(0, slot.value.end - now.value + BOUNDARY_GRACE_MS)
    timer = setTimer(() => {
      timer = undefined
      if (!running) return
      now.value = readNow()
      schedule()
    }, delay)
  }

  function start() {
    if (running) return
    running = true
    schedule()
  }

  function stop() {
    running = false
    cancel()
  }

  function refresh() {
    now.value = readNow()
    schedule()
  }

  return { now, slot, refresh, start, stop }
}

import { computed, ref } from 'vue'
import { CHAT_INPUT_LIMIT } from './chat-limits'

export interface HandoffPreview { current: string; incoming: string; title: string; origin: string }
export type HandoffChoice = 'new' | 'append' | 'cancel'
export function combineDrafts(current: string, incoming: string) {
  return !current.trim() ? incoming : current.trim() === incoming.trim() ? current : `${current}\n\n${incoming}`
}
export function createChatHandoff() {
  const pending = ref<HandoffPreview | null>(null)
  let finish: ((choice: HandoffChoice) => void) | null = null
  const canAppend = computed(() => !!pending.value && combineDrafts(pending.value.current, pending.value.incoming).length <= CHAT_INPUT_LIMIT)
  function resolve(choice: HandoffChoice) {
    if (choice === 'append' && !canAppend.value) return
    const done = finish; finish = null; pending.value = null; done?.(choice)
  }
  function cancel() { resolve('cancel') }
  function choose(preview: HandoffPreview): Promise<HandoffChoice> {
    cancel(); pending.value = preview
    return new Promise(done => { finish = done })
  }
  return { pending, canAppend, choose, resolve, cancel }
}

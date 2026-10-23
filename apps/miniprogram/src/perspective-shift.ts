import type { ChatMessage, PerspectiveShift } from './domain'

/** Offline build only; no production setting or network call enables this. */
export function prototypeAllowed(flag: unknown, base: unknown): boolean {
  return flag === 'true' && base === 'http://127.0.0.1:8019/api'
}
export const PERSPECTIVE_PROTOTYPE = prototypeAllowed(
  import.meta.env.VITE_PERSPECTIVE_PROTOTYPE, import.meta.env.VITE_API_BASE_URL,
)
export type PerspectiveAction = 'follow' | 'dismiss' | 'disable'
const privateText = /chain.?of.?thought|system.?prompt|reasoning_content|thinking_steps|tool_calls|工具参数|系统提示|系统指令|调试日志|<\/?think|traceback/i
const claims = ['observation', 'possible_blind_spot', 'alternative_perspective']

/** Runtime validation also protects restored/malformed payloads. Missing sources hide it. */
export function publicPerspective(value: unknown, token: unknown, messages: ChatMessage[]): PerspectiveShift | null {
  if (!value || typeof value !== 'object' || typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return null
  const p = value as PerspectiveShift
  if (p.title !== '换个角度' || !['repeated_choice', 'new_constraint', 'assistant_revision'].includes(p.trigger)) return null
  const fields = [p.observation, p.possible_blind_spot, p.alternative_perspective, p.uncertainty]
  if (p.optional_next_question != null) fields.push(p.optional_next_question)
  if (fields.some(s => typeof s !== 'string' || s.trim().length < 4 || s.length > 240 || privateText.test(s))) return null
  if (!Array.isArray(p.supporting_message_ids) || p.supporting_message_ids.length < 2 || p.supporting_message_ids.length > 4 ||
      new Set(p.supporting_message_ids).size !== p.supporting_message_ids.length ||
      !Array.isArray(p.evidence) || p.evidence.length < 2 || p.evidence.length > 4) return null
  const source = new Map(messages.filter(m => m.id).map(m => [m.id!, m]))
  if (p.supporting_message_ids.some(id => !source.has(id))) return null
  const covered = new Set<string>(), ids = new Set<string>()
  for (const e of p.evidence) {
    if (!e || !p.supporting_message_ids.includes(e.message_id) || typeof e.quote !== 'string' ||
        e.quote.length < 4 || e.quote.length > 160 || privateText.test(e.quote) ||
        !source.get(e.message_id)?.content.includes(e.quote) || !Array.isArray(e.supports) ||
        !e.supports.length || e.supports.length > 3 || e.supports.some(c => !claims.includes(c))) return null
    ids.add(e.message_id); e.supports.forEach(c => covered.add(c))
  }
  if (ids.size !== p.supporting_message_ids.length || covered.size !== 3 ||
      !p.supporting_message_ids.some(id => source.get(id)?.role === 'user')) return null
  return p
}

import type { ReasoningPoint } from './domain'

export const reasoningLabels = {
  understanding: '当前理解',
  basis: '回应依据',
  tradeoff: '建议取舍',
} as const

/** Display only grounded new-format explanations, never legacy raw traces. */
export function responseReasoning(value: unknown, reply: string): ReasoningPoint[] {
  if (!Array.isArray(value) || value.length < 2 || value.length > 3) return []
  const seen = new Set<string>()
  const texts = new Set<string>()
  for (const item of value) {
    if (!item || !Object.prototype.hasOwnProperty.call(reasoningLabels, item.kind) ||
        typeof item.text !== 'string' || item.text.length < 8 || item.text.length > 120 ||
        !reply.includes(item.text) || seen.has(item.kind) || texts.has(item.text) ||
        /chain.?of.?thought|system.?prompt|reasoning_content|thinking_steps|系统提示|系统指令|思维链|调试日志|工具参数|tool_calls|<think/i.test(item.text)) return []
    seen.add(item.kind)
    texts.add(item.text)
  }
  return value
}

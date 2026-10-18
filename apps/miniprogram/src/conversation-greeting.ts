import type { Issue, Memory } from './domain'

// Presentation only: never a model request, saved message, or inferred memory.
export function conversationGreeting(
  useMemory: boolean,
  memories: Pick<Memory, 'content' | 'enabled' | 'issue_id'>[],
  issue?: Pick<Issue, 'id' | 'actual_question'>,
): string {
  const short = (text: string) => {
    const chars = Array.from(text.trim().replace(/\s+/g, ' '))
    return chars.length > 54 ? chars.slice(0, 54).join('') + '…' : chars.join('')
  }
  const memory = useMemory && memories.find(m => m.enabled && m.content.trim() && (!m.issue_id || m.issue_id === issue?.id))
  if (memory) return `你提过「${short(memory.content)}」。今天想从哪里继续？`
  if (issue?.actual_question?.trim()) return `关于「${short(issue.actual_question)}」，今天想先聊哪一部分？`
  return '今天有什么想聊的？从一个问题或一个念头开始就好'
}

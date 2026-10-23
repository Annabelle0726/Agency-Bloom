import type { ChatResponse } from './domain'

export type ReplyPhase = 'waiting' | 'thinking' | 'writing' | 'checking'
export type ChatEvent = { type: 'phase'; phase: ReplyPhase } | { type: 'reply'; text: string }
  | { type: 'done'; response: ChatResponse } | { type: 'error'; status: number; detail: unknown }

// Mini Program runtimes do not consistently provide TextDecoder. Retain split
// UTF-8 sequences between native chunks, including four-byte emoji.
export function createEventStream(onEvent: (event: ChatEvent) => void) {
  let pending: number[] = [], buffer = '', terminal = false
  function consume(text: string) {
    buffer += text.replace(/\r/g, '')
    if (buffer.length > 524288) throw new Error('回复数据过长')
    let boundary: number
    while ((boundary = buffer.indexOf('\n\n')) >= 0) {
      const frame = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 2)
      const data = frame.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n')
      if (!data || terminal) continue
      const event = JSON.parse(data) as ChatEvent
      if (event.type === 'phase' && !['waiting', 'thinking', 'writing', 'checking'].includes(event.phase)) continue
      if (event.type === 'reply' && (typeof event.text !== 'string' || event.text.length > 262144)) throw new Error('回复格式不完整')
      if (!['phase', 'reply', 'done', 'error'].includes(event.type)) continue
      if (event.type === 'done' || event.type === 'error') terminal = true
      onEvent(event)
    }
  }
  return {
    push(chunk: ArrayBuffer | string) {
      if (typeof chunk === 'string') { consume(chunk); return }
      const bytes = [...pending, ...new Uint8Array(chunk)]; pending = []
      let text = ''
      for (let i = 0; i < bytes.length;) {
        const first = bytes[i]!, count = first < 128 ? 1 : first >= 0xC2 && first < 0xE0 ? 2 : first < 0xF0 && first >= 0xE0 ? 3 : first >= 0xF0 && first <= 0xF4 ? 4 : 0
        if (!count) throw new Error('回复编码不完整')
        if (i + count > bytes.length) { pending = bytes.slice(i); break }
        let code = first & (count === 1 ? 0x7F : (1 << (7 - count)) - 1)
        for (let j = 1; j < count; j++) {
          const byte = bytes[i + j]!
          if ((byte & 0xC0) !== 0x80) throw new Error('回复编码不完整')
          code = (code << 6) | (byte & 0x3F)
        }
        if (code > 0x10FFFF || (code >= 0xD800 && code <= 0xDFFF) || (count > 1 && code < [0, 0, 128, 2048, 65536][count]!)) throw new Error('回复编码不完整')
        text += String.fromCodePoint(code); i += count
      }
      consume(text)
    },
    finish() { if (!terminal || pending.length) throw new Error('回复连接已中断，输入仍保留，可查看这条请求的结果') },
  }
}

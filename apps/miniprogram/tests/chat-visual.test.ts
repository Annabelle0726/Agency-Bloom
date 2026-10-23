import { expect, it, vi } from 'vitest'
import { createChatSession } from '../src/chat'
import { resolveStoredVisual } from '../src/visual-library'
import type { ChatResponse } from '../src/domain'

function fixture() {
  let complete!: (reply: ChatResponse) => void
  const post = vi.fn((_id: string, _body: any) => ({
    promise: new Promise<ChatResponse>(resolve => { complete = resolve }),
    cancel: vi.fn(),
  }))
  const chat = createChatSession({ post, cancelRemote: vi.fn(async () => {}), requestId: () => 'qa',
    onError: vi.fn(), onCancelled: vi.fn() })
  return { chat, post, reply: (visual_id: string | null) => complete({ reply: 'Continue exploring', suggestion: null, mode: 'deepseek', visual_id }) }
}

it('persists the selected ID and excludes visible IDs on the next turn only in this conversation', async () => {
  const a = fixture(), b = fixture()
  a.chat.draft.value = 'Explore a new direction'
  const first = a.chat.send('a')
  a.reply('growth_handcraft_stitching_01'); await first
  expect(a.chat.messages.value.at(-1)?.payload?.visual_id).toBe('growth_handcraft_stitching_01')
  a.chat.draft.value = 'Another image'
  const next = a.chat.send('a')
  expect(a.post.mock.calls[1][1].visible_visual_ids).toEqual(['growth_handcraft_stitching_01'])
  b.chat.draft.value = 'Independent discussion'
  const other = b.chat.send('b')
  expect(b.post.mock.calls[0][1].visible_visual_ids).toEqual([])
  a.reply(null); b.reply(null); await Promise.all([next, other])
  a.chat.reset()
  a.chat.draft.value = 'Start again'
  const reset = a.chat.send('a')
  expect(a.post.mock.calls[2][1].visible_visual_ids).toEqual([])
  a.reply(null); await reset
})

it('omits visual selection history for a summary and preserves existing message images', async () => {
  const h = fixture()
  h.chat.messages.value = [{ role: 'assistant', content: 'Earlier reply', payload: { visual_id: 'growth_handcraft_stitching_01' } }]
  const pending = h.chat.send('a', 'summary')
  expect(h.post.mock.calls[0][1].visible_visual_ids).toEqual([])
  h.reply('another_id'); await pending
  expect(h.chat.messages.value).toHaveLength(1)
  expect(h.chat.messages.value[0].payload?.visual_id).toBe('growth_handcraft_stitching_01')
})

it('resolves saved IDs locally across themes and hides incompatible art without replacing its identity', () => {
  const id = 'growth_handcraft_stitching_01', h = fixture()
  const light = resolveStoredVisual(id, 'light')
  const forest = resolveStoredVisual(id, 'forest')
  expect(light?.id).toBe(id)
  expect(forest?.id).toBe(id)
  expect(light?.src).toMatch(/^https:\/\/ycombbpglsmbvjlrjtgc\.supabase\.co\//)
  expect(resolveStoredVisual(id, 'dark')).toBeNull()
  expect(resolveStoredVisual('unknown', 'light')).toBeNull()
  expect(h.post).not.toHaveBeenCalled()
})

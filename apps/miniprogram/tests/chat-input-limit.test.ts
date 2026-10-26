import { expect, it, vi } from 'vitest'
import { createChatSession } from '../src/chat'

it('accepts a complete Plan rewrite within the shared 4000 character limit', async () => {
  const post = vi.fn(() => ({ promise: Promise.resolve({ reply:'待确认草稿',suggestion:null,mode:'demo' as const }),cancel:vi.fn() }))
  const chat = createChatSession({post,cancelRemote:async()=>{},requestId:()=> 'one',onError:vi.fn(),onCancelled:vi.fn()})
  chat.draft.value = '稿'.repeat(3500)
  await chat.send('conversation')
  expect(chat.error.value).toBe('')
  expect(chat.messages.value[0].content).toHaveLength(3500)
  expect(chat.draft.value).toBe('')
})

import { expect, it } from 'vitest'
import { messageUnits, selectedExcerpt, nearestCharacter } from '../src/message-selection'
import { createChatSession } from '../src/chat'

it('selects only a contiguous excerpt without splitting common emoji', () => {
  const units = messageUnits('慢慢来 🌿👩‍💻，先休息')
  expect(units).toContain('👩‍💻')
  expect(selectedExcerpt(units, 4, 6)).toBe('🌿👩‍💻')
})

it('locates a touched character across wrapped lines', () => {
  const rects = [{left:0,top:0,right:10,bottom:20},{left:10,top:0,right:20,bottom:20},{left:0,top:20,right:10,bottom:40}]
  expect(nearestCharacter(rects, 4, 30)).toBe(2)
  expect(nearestCharacter(rects, 18, 8)).toBe(1)
})

it('Ask Bloom quotes only the chosen text and waits for the user to send', async () => {
  let body: any, calls = 0
  const session = createChatSession({ requestId: () => 'quote', onError() {}, onCancelled() {}, cancelRemote: async () => {},
    post: (_id, request) => { calls++; body = request; return { cancel() {}, promise: Promise.resolve({reply:'可以先试一次',suggestion:null} as any) } } })
  session.selectedQuote.value = '先休息'
  expect(calls).toBe(0)
  session.draft.value = '你说的是哪种休息？'
  await session.send('conversation')
  expect(body.message).toContain('先休息')
  expect(body.message).toContain('你说的是哪种休息？')
  expect(calls).toBe(1)
  expect(session.selectedQuote.value).toBe('')
})

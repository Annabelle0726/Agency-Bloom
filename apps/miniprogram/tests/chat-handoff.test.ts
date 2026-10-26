import { expect, it } from 'vitest'
import { createChatHandoff } from '../src/chat-handoff'

it('requires a choice for a conflicting draft and preserves both previews', async () => {
  const sheet = createChatHandoff()
  const result = sheet.choose({ current:'还没写完', incoming:'来自 Plan 的内容', title:'求职', origin:'Plan' })
  expect(sheet.pending.value?.current).toBe('还没写完')
  expect(sheet.pending.value?.incoming).toBe('来自 Plan 的内容')
  sheet.resolve('append')
  expect(await result).toBe('append')
  expect(sheet.pending.value).toBeNull()
})
it('cancels pending choices when scope changes or the sheet closes', async () => {
  const sheet = createChatHandoff()
  const result = sheet.choose({ current:'旧草稿',incoming:'新内容',title:'求职',origin:'发现' })
  sheet.cancel()
  expect(await result).toBe('cancel')
})
it('does not permit a combined draft to exceed the shared input limit', async () => {
  const sheet = createChatHandoff()
  const result = sheet.choose({ current:'字'.repeat(3999),incoming:'新文字',title:'求职',origin:'Plan' })
  expect(sheet.canAppend.value).toBe(false)
  sheet.resolve('append')
  expect(sheet.pending.value).not.toBeNull()
  sheet.resolve('new')
  expect(await result).toBe('new')
})

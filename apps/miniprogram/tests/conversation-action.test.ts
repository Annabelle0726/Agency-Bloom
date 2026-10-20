import { expect, it, vi } from 'vitest'
import { createConversationAction } from '../src/conversation-action'
import type { Conversation } from '../src/domain'

const item = { id: 'owned-c', title: '原名', version: 7, archived_at: null } as Conversation
it('renames the captured conversation with its version and prevents duplicate saves', async () => {
  let resolve!: (value: Conversation) => void
  const request = vi.fn(() => new Promise<Conversation>(yes => { resolve = yes }))
  const changed = vi.fn(), deleted = vi.fn()
  const action = createConversationAction('rename', item, request, changed, deleted)
  action.title.value = '  新名字  '
  const pending = action.save()
  await action.save()
  expect(request).toHaveBeenCalledExactlyOnceWith('PUT', '/conversations/owned-c', { version: 7, title: '新名字' })
  resolve({ ...item, title: '新名字', version: 8 })
  expect(await pending).toBe(true)
  expect(changed).toHaveBeenCalledWith(expect.objectContaining({ title: '新名字' }))
  expect(deleted).not.toHaveBeenCalled()
})
it('preserves the rename input after a version conflict and rejects empty titles', async () => {
  const request = vi.fn(async () => { throw Error('会话已更新，请重新打开') })
  const action = createConversationAction('rename', item, request, vi.fn(), vi.fn())
  action.title.value = '   '
  expect(await action.save()).toBe(false)
  expect(request).not.toHaveBeenCalled()
  action.title.value = '想保留的输入'
  expect(await action.save()).toBe(false)
  expect(action.title.value).toBe('想保留的输入')
  expect(action.error.value).toContain('重新打开')
  expect(action.busy.value).toBe(false)
})
it('archives and deletes only the captured target, without a model call', async () => {
  const request = vi.fn(async () => ({ ...item, archived_at: 'today', version: 8 }))
  const changed = vi.fn(), deleted = vi.fn()
  expect(await createConversationAction('archive', item, request, changed, deleted).save()).toBe(true)
  expect(request).toHaveBeenLastCalledWith('PUT', '/conversations/owned-c', { version: 7, archived: true })
  expect(await createConversationAction('delete', item, request, changed, deleted).save()).toBe(true)
  expect(request).toHaveBeenLastCalledWith('DELETE', '/conversations/owned-c?version=7')
  expect(deleted).toHaveBeenCalledWith('owned-c')
})

import { expect, it, vi } from 'vitest'
import { createAvatarStore } from '../src/avatar'

it('keeps a chosen avatar local and isolated by account, replacing and removing saved files', async () => {
  const values = new Map<string, string>()
  const remove = vi.fn(async (_path: string) => {})
  const store = createAvatarStore({ read: key => values.get(key) || '', write: (key, path) => { values.set(key, path) },
    save: async path => 'saved:' + path, remove })
  expect(store.read('alice')).toBe('')
  await store.choose('alice', 'temp-one')
  expect(store.read('alice')).toBe('saved:temp-one')
  expect(store.read('bob')).toBe('')
  await store.choose('alice', 'temp-two')
  expect(remove).toHaveBeenCalledWith('saved:temp-one')
  await store.clear('alice')
  expect(store.read('alice')).toBe('')
  expect(remove).toHaveBeenCalledWith('saved:temp-two')
})

it('keeps the previous avatar when saving the new image fails and ignores empty selection', async () => {
  const write = vi.fn(), save = vi.fn(async () => { throw Error('disk full') })
  const store = createAvatarStore({ read: () => 'saved:old', write, save, remove: async () => {} })
  await expect(store.choose('alice', 'new')).rejects.toThrow('disk full')
  await store.choose('alice', '')
  expect(write).not.toHaveBeenCalled()
  expect(save).toHaveBeenCalledTimes(1)
})

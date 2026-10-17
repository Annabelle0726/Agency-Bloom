import { expect, it } from 'vitest'
import { createOperationState } from '../src/operations'

it('keeps initialization, authentication, data and chat failures independent', async () => {
  const state = createOperationState()
  await state.run('init', async () => { throw Error('offline') })
  expect(state.errors.init).toBe('offline')
  expect(state.errors.auth).toBe('')
  expect(state.busy.auth).toBe(false)
  await state.run('ai', async () => { throw Error('model failed') })
  expect(state.errors.data).toBe('')
  expect(state.errors.ai).toBe('model failed')
  await state.run('auth', async () => { throw Error('cannot log in') })
  state.clear('auth')
  expect(state.errors.auth).toBe('')
  expect(state.errors.init).toBe('offline')
})

it('blocks duplicate work only in the same scope', async () => {
  const state = createOperationState()
  let finish!: () => void, count = 0
  const pending = state.run('init', () => new Promise<void>(resolve => { finish = resolve }))
  await state.run('auth', async () => { count++ })
  await state.run('init', async () => { count += 100 })
  expect(count).toBe(1)
  finish(); await pending
})

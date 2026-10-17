import { expect, it, vi } from 'vitest'
import { createApi } from '../src/http'

it('rejects unauthorized responses and clears the local session', async () => {
  const unauthorized = vi.fn()
  const transport = (options: any) => {
    options.success({ statusCode: 401, data: { detail: '请重新登录' } })
    return { abort() {} }
  }
  const api = createApi(transport, () => 'session-token', unauthorized, 'http://localhost/api')
  await expect(api.request('GET', '/me').promise).rejects.toMatchObject({ status: 401 })
  expect(unauthorized).toHaveBeenCalledOnce()
})

it('cancel rejects promptly and ignores a late successful native response', async () => {
  let native: any
  const abort = vi.fn()
  const api = createApi((options: any) => { native = options; return { abort } }, () => '', () => {}, '')
  const request = api.request('POST', '/chat', {})
  request.cancel()
  await expect(request.promise).rejects.toMatchObject({ cancelled: true })
  expect(abort).toHaveBeenCalledOnce()
  native.success({ statusCode: 200, data: { reply: 'late reply' } })
})

it('preserves server budget errors for a useful user-facing message', async () => {
  const api = createApi((options: any) => {
    options.success({ statusCode: 402, data: { detail: '本月额度已用完' } })
    return { abort() {} }
  }, () => '', () => {}, '')
  await expect(api.request('POST', '/chat', {}).promise).rejects.toMatchObject({ status: 402, message: '本月额度已用完' })
})

export type ErrorKind = 'network' | 'timeout' | 'http' | 'auth' | 'model' | 'cancelled'
export class ApiError extends Error {
  constructor(message: string, public status = 0, public cancelled = false, public kind: ErrorKind = cancelled ? 'cancelled' : 'http') { super(message) }
}
interface NativeOptions {
  url: string; method: 'GET' | 'POST' | 'PUT' | 'DELETE'; data?: any;
  header: Record<string, string>; timeout: number;
  success: (response: { statusCode: number; data: any }) => void;
  fail: (error: { errMsg?: string }) => void
}
type Transport = (options: NativeOptions) => { abort: () => void }
interface Diagnostic { kind: ErrorKind; status: number; method: string; route: string }
export function createApi(transport: Transport, token: () => string, unauthorized: () => void, base: string,
  diagnostic: (event: Diagnostic) => void = event => { if (import.meta.env.DEV) console.warn('[Agency Bloom request]', event) }) {
  return {
    request<T>(method: NativeOptions['method'], path: string, data?: unknown) {
      let settled = false
      let task: { abort: () => void } | undefined
      let rejectRequest: (reason: Error) => void = () => {}
      const route = path.split('?')[0].replace(/\/(issues|requests)\/[^/]+/, '/$1/:id')
      const report = (kind: ErrorKind, status = 0) => diagnostic({ kind, status, method, route })
      const promise = new Promise<T>((resolve, reject) => {
        rejectRequest = reject
        const header: Record<string, string> = { 'Content-Type': 'application/json' }
        if (token()) header.Authorization = `Bearer ${token()}`
        task = transport({ url: base.replace(/\/$/, '') + path, method, data, header, timeout: path.endsWith('/chat') ? 65000 : 15000,
          success(response) {
            if (settled) return
            settled = true
            if (response.statusCode >= 200 && response.statusCode < 300) resolve(response.data as T)
            else {
              if (response.statusCode === 401) unauthorized()
              const status = response.statusCode
              const kind = status === 401 ? 'auth' : status >= 500 && path.endsWith('/chat') ? 'model' : 'http'
              const safeDetail = [402, 409, 429].includes(status) && typeof response.data?.detail === 'string' ? response.data.detail.slice(0, 180) : ''
              const message = kind === 'auth' ? '登录已失效，请重新登录' : kind === 'model' ? 'AI 服务暂时没有完成回复，请稍后再试' : safeDetail || (status === 422 ? '请检查填写内容后再试' : '服务暂时没有完成操作，请稍后再试')
              report(kind, status)
              reject(new ApiError(message, status, false, kind))
            }
          },
          fail(error) {
            if (settled) return
            settled = true
            const kind = /timeout|timed out/i.test(error.errMsg || '') ? 'timeout' : 'network'
            report(kind)
            reject(new ApiError(kind === 'timeout' ? '连接等待较久，请稍后再试' : '暂时无法连接服务，请稍后再试', 0, false, kind))
          },
        })
      })
      return { promise, cancel() {
        if (settled) return
        settled = true
        task?.abort()
        report('cancelled')
        rejectRequest(new ApiError('已停止回复，你可以继续编辑', 0, true))
      } }
    },
  }
}

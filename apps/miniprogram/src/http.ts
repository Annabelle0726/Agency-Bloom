export class ApiError extends Error {
  constructor(message: string, public status = 0, public cancelled = false) { super(message) }
}
interface NativeOptions {
  url: string; method: 'GET' | 'POST' | 'PUT' | 'DELETE'; data?: any;
  header: Record<string, string>; timeout: number;
  success: (response: { statusCode: number; data: any }) => void;
  fail: (error: { errMsg?: string }) => void
}
type Transport = (options: NativeOptions) => { abort: () => void }
export function createApi(transport: Transport, token: () => string, unauthorized: () => void, base: string) {
  return {
    request<T>(method: NativeOptions['method'], path: string, data?: unknown) {
      let settled = false
      let task: { abort: () => void } | undefined
      let rejectRequest: (reason: Error) => void = () => {}
      const promise = new Promise<T>((resolve, reject) => {
        rejectRequest = reject
        const header: Record<string, string> = { 'Content-Type': 'application/json' }
        if (token()) header.Authorization = `Bearer ${token()}`
        task = transport({ url: base.replace(/\/$/, '') + path, method, data, header, timeout: 65000,
          success(response) {
            if (settled) return
            settled = true
            if (response.statusCode >= 200 && response.statusCode < 300) resolve(response.data as T)
            else {
              if (response.statusCode === 401) unauthorized()
              reject(new ApiError(typeof response.data?.detail === 'string' ? response.data.detail : '暂时没有完成，请稍后重试', response.statusCode))
            }
          },
          fail() {
            if (settled) return
            settled = true
            reject(new ApiError('连接暂时没有完成，请检查网络，输入的内容还在'))
          },
        })
      })
      return { promise, cancel() {
        if (settled) return
        settled = true
        task?.abort()
        rejectRequest(new ApiError('已停止回复，你可以继续编辑', 0, true))
      } }
    },
  }
}

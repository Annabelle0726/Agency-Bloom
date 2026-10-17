import { reactive } from 'vue'

export type OperationScope = 'init' | 'auth' | 'data' | 'ai'
export function createOperationState() {
  const errors = reactive({ init: '', auth: '', data: '', ai: '' })
  const busy = reactive({ init: false, auth: false, data: false, ai: false })
  function clear(scope: OperationScope) { errors[scope] = '' }
  async function run(scope: OperationScope, action: () => Promise<void>) {
    if (busy[scope]) return false
    busy[scope] = true; clear(scope)
    try { await action(); return true }
    catch (err) { errors[scope] = err instanceof Error ? err.message : '暂时没有完成，请稍后重试'; return false }
    finally { busy[scope] = false }
  }
  return { errors, busy, run, clear }
}

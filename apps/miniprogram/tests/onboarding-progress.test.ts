import { expect, it, vi } from 'vitest'
import { createOnboardingProgress } from '../src/onboarding-progress'
import { newOnboarding, saveDraft, restoreDraft } from '../src/onboarding'

function setup() {
  const data = new Map<string, unknown>()
  let remote: any = null
  let offline = false
  const save = vi.fn(async (body: any) => {
    if (offline) throw Error('offline')
    if (body.version !== (remote?.version || 0)) throw Object.assign(Error('conflict'), { status: 409 })
    remote = { ...structuredClone(body), version: body.version + 1, updated_at: '2026-10-26' }
    return remote
  })
  const options = { storage: { read: (key: string) => data.get(key), write: (key: string, value: unknown) => { data.set(key, structuredClone(value)) }, remove: (key: string) => { data.delete(key) } },
    transport: { get: async () => { if (offline) throw Error('offline'); return structuredClone(remote) }, save }, debounceMs: 60_000 }
  const sync = createOnboardingProgress(options)
  sync.reset('a')
  return { sync, options, save, data, remote: () => remote, setRemote: (value: any) => { remote = value }, offline: (value: boolean) => { offline = value } }
}
const answer = () => saveDraft({ ...newOnboarding(), concerns: ['relationships'], exploration_intent: 'relationships', background: '自己填写的回答' }, 1)

it('keeps offline answers and question position across restart, then synchronizes on reconnect', async () => {
  const env = setup(); env.offline(true)
  env.sync.set(answer()); await env.sync.flush()
  const restored = createOnboardingProgress(env.options); restored.reset('a')
  expect(restored.snapshot()?.step).toBe(1)
  expect(restored.snapshot()?.form.background).toBe('自己填写的回答')
  env.offline(false); await restored.retry()
  expect(env.remote().answers.background).toBe('自己填写的回答')
  expect(env.remote().step).toBe(1)
  expect(restored.mode.value).toBe('synced')
  env.sync.dispose(); restored.dispose()
})

it('restores paused cloud progress on another device without resuming the questionnaire automatically', async () => {
  const env = setup(); env.sync.set(answer()); env.sync.pause(); await env.sync.flush()
  const other = createOnboardingProgress({ ...env.options, storage: { read: () => undefined, write: () => {}, remove: () => {} } })
  other.reset('a'); await other.load()
  expect(other.paused()).toBe(true); expect(other.snapshot()?.step).toBe(1)
  env.sync.dispose(); other.dispose()
})

it('preserves local and remote updates on version conflict until the user chooses', async () => {
  const env = setup(); await env.sync.load(); env.sync.set(answer())
  env.setRemote({ version: 2, step: 3, status: 'paused', answers: { ...newOnboarding(), background: '另一台设备' }, updated_at: 'now' })
  await env.sync.flush()
  expect(env.sync.mode.value).toBe('conflict')
  expect(env.sync.snapshot()?.form.background).toBe('自己填写的回答')
  await env.sync.useRemote()
  expect(env.sync.snapshot()?.step).toBe(3)
  expect(env.sync.snapshot()?.form.background).toBe('另一台设备')
  env.sync.set(answer()); env.setRemote({ ...env.remote(), version: 5 })
  await env.sync.flush(); await env.sync.keepLocal()
  expect(env.remote().version).toBe(6)
  expect(env.remote().answers.background).toBe('自己填写的回答')
  env.sync.dispose()
})

it('serializes autosaves so typing during a request is sent afterward', async () => {
  const env = setup(); await env.sync.load()
  let release: (value: any) => void = () => {}
  env.save.mockImplementationOnce((body: any) => new Promise(resolve => { release = () => { const row = { ...body, version: 1, updated_at: 'now' }; env.setRemote(row); resolve(row) } }))
  env.sync.set(answer()); const pending = env.sync.flush(); await Promise.resolve()
  env.sync.set(saveDraft({ ...answer().form, background: '较新的输入' }, 2)); release(null); await pending
  expect(env.remote().answers.background).toBe('较新的输入')
  expect(env.remote().step).toBe(2)
  env.sync.dispose()
})

it('isolates accounts, ignores late responses, and keeps completed drafts cleared', async () => {
  const env = setup(); env.sync.set(answer()); await env.sync.flush()
  const version = await env.sync.prepareCompletion(); env.sync.completed()
  expect(env.sync.snapshot()).toBeNull()
  const restored = createOnboardingProgress(env.options); restored.reset('a')
  expect(restored.snapshot()).toBeNull()
  env.sync.reset('b'); expect(env.sync.snapshot()).toBeNull()
  expect(version).toBe(1)
  env.sync.dispose(); restored.dispose()
})

it('keeps new account drafts beyond seven days while still accepting legacy drafts', () => {
  expect(restoreDraft(saveDraft(newOnboarding(), 1, 1000), 30 * 86400000)?.step).toBe(1)
  expect(restoreDraft({ ...saveDraft(newOnboarding(), 1, 1000), version: 3 }, 2000)?.step).toBe(1)
})

it('recognizes a saved draft after its response was lost without resending or inventing a conflict', async () => {
  const env = setup(); await env.sync.load()
  env.save.mockImplementationOnce(async (body: any) => {
    env.setRemote({ ...body, version: 1, updated_at: 'now' }); throw Error('response lost')
  })
  env.sync.set(answer()); await env.sync.flush(); await env.sync.retry()
  expect(env.save).toHaveBeenCalledTimes(1)
  expect(env.sync.mode.value).toBe('synced')
  expect(env.sync.snapshot()?.form.background).toBe('自己填写的回答')
  env.sync.dispose()
})

it('does not apply an old account response after switching accounts', async () => {
  const env = setup()
  let resolve: (row: any) => void = () => {}
  const other = createOnboardingProgress({ ...env.options, transport: {
    ...env.options.transport, get: () => new Promise(done => { resolve = done }),
  } })
  other.reset('a'); const pending = other.load(); other.reset('b')
  resolve({ version: 5, step: 1, status: 'paused', answers: answer().form, updated_at: 'now' }); await pending
  expect(other.snapshot()).toBeNull()
  expect(other.restored.value).toBeNull()
  env.sync.dispose(); other.dispose()
})

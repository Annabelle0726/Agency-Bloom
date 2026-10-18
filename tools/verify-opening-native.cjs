// Simulator integration QA. Mock every request; never send onboarding data to a real service.
const auto = require('../output/native-sdk/node_modules/miniprogram-automator')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
const dir = path.resolve(__dirname, '../output/opening')
const uid = 'opening-qa-user'
const keys = ['agency.session', 'agency.onboarding.v2', 'agency.opening.story.v1', 'agency.onboarding.v3.' + uid, 'agency.onboarding.paused.v1.' + uid]
let mp, page, mocked = false
const backups = new Map()
const exceptions = []
async function fresh() { page = await mp.currentPage(); assert.ok(page); return page }
async function component(name) { await fresh(); const c = await page.$('components\\/' + name); assert.ok(c, 'Missing ' + name); return c }
async function action(c, index = 0) { const a = (await c.$$('components\\/ActionButton'))[index]; assert.ok(a); await (await a.$('button')).tap(); await wait(450) }
async function relaunch() { await mp.reLaunch('/pages/index/index'); await wait(650); await fresh() }
async function shot(name) { await mp.screenshot({ path: path.join(dir, name + '.png') }) }
;(async () => {
  await fs.mkdir(dir, { recursive: true })
  mp = await auto.connect({ wsEndpoint: process.env.AGENCY_QA_WS || 'ws://127.0.0.1:9430' })
  mp.on('exception', e => exceptions.push(String(e)))
  const storedKeys = (await mp.callWxMethod('getStorageInfoSync')).keys
  for (const key of keys) backups.set(key, { exists: storedKeys.includes(key), value: await mp.callWxMethod('getStorageSync', key) })
  await mp.evaluate(() => { getApp().__openingQA = { issue: null, calls: [] } })
  await mp.mockWxMethod('request', function(options) {
    const qa = getApp().__openingQA
    const route = options.url.split('/api')[1] || ''
    const method = options.method || 'GET'
    qa.calls.push(method + ' ' + route)
    const user = { id: 'opening-qa-user', theme: 'light', save_chat: false, ai_consent: false, support_style: 'listen' }
    let data = null, statusCode = 200
    if (route === '/config') data = { dev_auth: true, wechat_auth: false, ai_mode: 'demo' }
    else if (route === '/auth/dev') data = { token: 'opening-qa-token', user }
    else if (route === '/me') data = user
    else if (route === '/issues/current') data = qa.issue
    else if (route === '/issues' && method === 'GET') data = qa.issue ? [qa.issue] : []
    else if (route === '/issues' && method === 'POST') {
      qa.issue = {
        id: 'opening-qa-issue', ...options.data, version: 1, created_at: '2026-10-18T00:00:00Z', updated_at: '2026-10-18T00:00:00Z', ended_at: null, feedback: [],
        card: { title: '', options: [], constraints: [], confirmed: [], hypotheses: [], unknowns: [], next_step: '' }
      }
      data = qa.issue
    } else if (route.endsWith('/messages')) data = []
    else { statusCode = 400; data = { detail: 'Unexpected QA route ' + route } }
    return { statusCode, data, header: {}, errMsg: 'request:ok' }
  })
  mocked = true
  for (const key of keys) await mp.callWxMethod('removeStorageSync', key)
  await relaunch()
  const info = await mp.systemInfo()
  let story = await component('WelcomeOpening')
  assert.equal((await story.$$('components\\/ActionButton')).length, 0, 'No continue-reading button')
  await wait(1800); await shot('01-mountain-person')
  for (let i = 1; i < 5; i++) {
    await (await story.$('.story-page')).tap(); await wait(1800)
    assert.match(await (await story.$('.story-count')).text(), new RegExp((i + 1) + ' / 5'))
  }
  assert.equal((await story.$$('components\\/ActionButton')).length, 1)
  await shot('02-final-manifesto')
  const footer = await story.$('.story-footer')
  assert.ok((await footer.offset()).top + Number((await footer.size()).height) <= info.windowHeight + 2, 'Final button must fit')
  await action(story)
  let auth = await component('AuthWelcome')
  assert.equal(await page.$('components\\/OnboardingFlow'), null, 'Questions appear only after authentication')
  await shot('03-auth')
  await relaunch()
  auth = await component('AuthWelcome')
  await (await auth.$('.auth-top button')).tap(); await wait(400)
  story = await component('WelcomeOpening')
  await (await story.$('.story-skip')).tap(); await wait(400)
  auth = await component('AuthWelcome')
  await (await auth.$('.auth-check')).tap()
  await action(auth, 1) // WeChat disabled in isolated QA; explicit local demo login.
  let flow = await component('OnboardingFlow')
  assert.equal((await flow.$$('textarea')).length, 0, 'No open text fields on arrival')
  let calls = await mp.evaluate(() => getApp().__openingQA.calls)
  assert.equal(calls.filter(v => v === 'POST /issues').length, 0, 'Login must not create an empty exploration')
  await shot('04-concerns')
  await (await flow.$('.flow-skip')).tap(); await wait(400)
  await relaunch()
  assert.ok(await page.$('.workspace'), 'Paused onboarding goes to empty home on return')
  assert.equal(await page.$('components\\/OnboardingFlow'), null)
  await shot('05-paused-home')
  const form = { title: '', concerns: ['direction'], exploration_intent: 'direction', stage: 'unsure', background: '', constraints: [], life_contexts: [], support_style: 'listen', actual_question: '', focus_response: '' }
  await mp.callWxMethod('removeStorageSync', 'agency.onboarding.paused.v1.' + uid)
  await mp.callWxMethod('setStorageSync', 'agency.onboarding.v3.' + uid, { version: 3, form, step: 2, savedAt: Date.now() })
  await relaunch()
  flow = await component('OnboardingFlow')
  assert.ok(await flow.$('.life-contexts'), 'Resume saved question')
  assert.equal((await flow.$$('textarea')).length, 0, 'Context writing stays optional and collapsed')
  await action(flow)
  await action(flow)
  await action(flow)
  await wait(500); await fresh()
  assert.ok(await page.$('.workspace'), 'Save goes straight home')
  assert.equal(await page.$('components\\/FirstArrival'), null, 'No duplicate manifesto')
  await relaunch()
  assert.ok(await page.$('.workspace'), 'Existing account skips opening and questions')
  calls = await mp.evaluate(() => getApp().__openingQA.calls)
  assert.equal(calls.filter(v => v === 'POST /issues').length, 1)
  assert.equal(calls.some(v => v.includes('/chat')), false)
  assert.deepEqual(exceptions, [])
  const report = { passed: true, width: info.windowWidth, height: info.windowHeight, slides: 5, native_navigation: true, backend_requests: 0, model_requests: 0, exceptions }
  await fs.writeFile(path.join(dir, 'report.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report))
})().catch(e => { console.error(e.stack); process.exitCode = 1 }).finally(async () => {
  if (!mp) return
  try {
    for (const [key, saved] of backups) {
      if (saved.exists) await mp.callWxMethod('setStorageSync', key, saved.value)
      else await mp.callWxMethod('removeStorageSync', key)
    }
    if (mocked) await mp.restoreWxMethod('request')
    await mp.evaluate(() => { delete getApp().__openingQA })
    await mp.reLaunch('/pages/index/index')
  } finally { await mp.disconnect() }
})

// Isolated first-use simulator QA: wx.request is mocked, no backend/model calls.
const auto = require('../output/native-sdk/node_modules/miniprogram-automator')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const wait = ms => new Promise(r => setTimeout(r, ms))
const dir = path.resolve(__dirname, '../output/opening')
let mp, page, mocked = false
const backups = new Map()
const keys = ['agency.session', 'agency.onboarding.v2', 'agency.opening.story.v1', 'agency.arrival.v1.opening-qa-user']
const exceptions = []
async function fresh() { page = await mp.currentPage(); assert.ok(page); return page }
async function component(name) { await fresh(); const c = await page.$('components\\/' + name); assert.ok(c, 'Missing ' + name); return c }
async function action(c, index = 0) { const a = (await c.$$('components\\/ActionButton'))[index]; assert.ok(a); await (await a.$('button')).tap(); await wait(350) }
async function shot(name) { await mp.screenshot({ path: path.join(dir, name + '.png') }) }
async function relaunch() { await mp.reLaunch('/pages/index/index'); await wait(400); await fresh() }
;(async () => {
  await fs.mkdir(dir, { recursive: true })
  mp = process.env.AGENCY_QA_LAUNCH === '1'
    ? await auto.launch({ cliPath: 'C:/Software/Tencent/微信web开发者工具/cli.bat', projectPath: path.resolve(__dirname, '..'), timeout: 30000 })
    : await auto.connect({ wsEndpoint: process.env.AGENCY_QA_WS || 'ws://127.0.0.1:9430' })
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
    else if (route === '/issues' && method === 'POST') {
      qa.issue = {
        id: 'opening-qa-issue', ...options.data, version: 1, created_at: '2026-10-17T00:00:00Z', updated_at: '2026-10-17T00:00:00Z', ended_at: null, feedback: [],
        card: { title: '', options: [], constraints: [], confirmed: [], hypotheses: [], unknowns: [], next_step: '' }
      }
      data = qa.issue
    } else if (route.endsWith('/messages')) data = []
    else { statusCode = 400; data = { detail: 'Unexpected QA route' } }
    setTimeout(() => {
      const result = { statusCode, data, header: {}, errMsg: 'request:ok' }
      if (options.success) options.success(result)
      if (options.complete) options.complete(result)
    }, 0)
    return { abort() {} }
  })
  mocked = true
  for (const key of keys) await mp.callWxMethod('removeStorageSync', key)
  await relaunch()
  const info = await mp.systemInfo()
  let flow = await component('OnboardingFlow')
  let story = await flow.$('components\\/WelcomeOpening')
  assert.ok(story, 'Fresh visitor should see slideshow')
  assert.match(await (await story.$('.story-count')).text(), /1 \/ 5/)
  await wait(1800); await shot('01-first-slide')
  await (await story.$('.story-stage')).tap(); await wait(450)
  assert.match(await (await story.$('.story-count')).text(), /2 \/ 5/)
  await wait(1800); await shot('02-second-slide')
  await (await story.$('.story-page')).tap(); await wait(450)
  assert.match(await (await story.$('.story-count')).text(), /3 \/ 5/)
  await wait(1800); await shot('03-third-slide')
  for (let i = 3; i < 5; i++) {
    await (await story.$('.story-page')).tap(); await wait(1800)
    assert.match(await (await story.$('.story-count')).text(), new RegExp((i + 1) + ' / 5'))
    await shot('slide-' + (i + 1))
  }
  assert.equal((await story.$$('.story-scene')).length, 5)
  assert.equal((await story.$$('.scene-active')).length, 1)
  const footer = await story.$('.story-footer')
  assert.ok((await footer.offset()).top + Number((await footer.size()).height) <= info.windowHeight + 2, 'Slideshow footer is clipped')
  await action(story)
  flow = await component('OnboardingFlow')
  assert.ok(await flow.$('.selection-stack'), 'Final CTA must enter the questions')
  await relaunch()
  flow = await component('OnboardingFlow')
  assert.equal(await flow.$('components\\/WelcomeOpening'), null, 'Returning anonymous user should resume questions')
  await (await flow.$('.flow-back')).tap(); await wait(250)
  story = await flow.$('components\\/WelcomeOpening')
  assert.ok(story, 'User may deliberately revisit opening')
  await (await story.$('.story-skip')).tap(); await wait(250)
  assert.ok(await flow.$('.selection-stack'), 'Skip must enter questions immediately')
  const form = { title: '', concerns: ['direction'], exploration_intent: 'direction', stage: 'unsure', background: '', constraints: [], life_contexts: [], support_style: 'listen', actual_question: '', focus_response: '希望给生活留出一点自己的时间' }
  await mp.callWxMethod('setStorageSync', 'agency.onboarding.v2', { version: 3, form, step: 5, savedAt: Date.now() })
  await relaunch()
  flow = await component('OnboardingFlow')
  await (await flow.$('.consent-check-target')).tap()
  await action(flow, 1)
  await wait(500)
  let arrival = await component('FirstArrival')
  assert.match(await (await arrival.$('.arrival-title')).text(), /按自己的意愿活一活/)
  assert.equal(await page.$('.workspace'), null, 'Home must not overlap the introduction')
  const dock = await arrival.$('.arrival-footer')
  assert.ok((await dock.offset()).top + Number((await dock.size()).height) <= info.windowHeight + 2, 'Entry button is clipped')
  await shot('04-first-arrival')
  await (await arrival.$('.arrival-scroll')).scrollTo(0, 9999); await wait(150)
  await shot('05-first-arrival-bottom')
  await relaunch()
  arrival = await component('FirstArrival')
  await action(arrival)
  await fresh()
  assert.ok(await page.$('.workspace'), 'Entry must reach home')
  await relaunch()
  assert.ok(await page.$('.workspace'), 'Completed introduction must not repeat')
  const calls = await mp.evaluate(() => getApp().__openingQA.calls)
  assert.equal(calls.filter(v => v === 'POST /issues').length, 1, 'Navigation must not create duplicate explorations')
  assert.equal(calls.some(v => v.includes('/chat')), false)
  assert.deepEqual(exceptions, [])
  const report = { passed: true, width: info.windowWidth, height: info.windowHeight, slides: 5, native_navigation: true, backend_requests: 0, model_requests: 0, exceptions }
  await fs.writeFile(path.join(dir, 'report.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report))
})().catch(e => { console.error(e.message); process.exitCode = 1 }).finally(async () => {
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

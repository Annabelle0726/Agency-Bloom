// Verify time-of-day auto theming and the manual-pick override on the simulator.
const auto = require('../output/native-sdk/node_modules/miniprogram-automator')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const wait = ms => new Promise(r => setTimeout(r, ms))
const out = path.resolve('output/auto-theme')
const keys = ['agency.session','agency.opening.story.v1','agency.onboarding.paused.v1.theme-qa-user','agency.onboarding.v3.theme-qa-user','agency.theme.manual.v1.theme-qa-user']
const backups = new Map()
let mp, page, mocked = false
;(async () => {
  await fs.mkdir(out, { recursive: true })
  mp = await auto.connect({ wsEndpoint: process.env.AGENCY_QA_WS || 'ws://127.0.0.1:9430' })
  const savedKeys = (await mp.callWxMethod('getStorageInfoSync')).keys
  for (const key of keys) backups.set(key, { exists: savedKeys.includes(key), value: await mp.callWxMethod('getStorageSync', key) })
  await mp.evaluate(() => {
    getApp().__themeQA = { hasIssue: true, user: { id: 'theme-qa-user', theme: 'light', ai_consent: false, save_chat: false, support_style: 'listen' } }
  })
  await mp.mockWxMethod('request', function (options) {
    const qa = getApp().__themeQA, route = options.url.split('/api')[1] || '', method = options.method || 'GET'
    const issue = { id: 'gem-issue', title: '探索适合自己的工作与生活', concerns: ['direction'], exploration_intent: 'direction', stage: 'unsure', background: '', constraints: [], life_contexts: [], support_style: 'listen', actual_question: '', focus_response: '想把时间留给有意义的事情', version: 1, created_at: '2026-10-18T00:00:00Z', updated_at: '2026-10-18T00:00:00Z', ended_at: null, feedback: [], card: { title: '找到愿意亲自度过的生活', options: [], constraints: [], confirmed: [], hypotheses: [], unknowns: [], next_step: '' } }
    let data = null, statusCode = 200
    if (route === '/config') data = { dev_auth: true, wechat_auth: false, ai_mode: 'demo' }
    else if (route === '/me') { if (method === 'PUT') { qa.user = { ...qa.user, ...options.data } } data = qa.user }
    else if (route === '/issues/current') data = qa.hasIssue ? issue : null
    else if (route.startsWith('/issues')) data = qa.hasIssue ? [issue] : []
    else if (route.startsWith('/conversations')) data = []
    else if (route === '/usage') data = { used_cny: 0, limit_cny: 20, daily_calls: 0, daily_limit: 30, mode: 'demo' }
    else { statusCode = 400; data = { detail: 'Unexpected QA request ' + route } }
    return { statusCode, data, header: {}, errMsg: 'request:ok' }
  })
  mocked = true
  await mp.callWxMethod('setStorageSync', 'agency.session', 'theme-qa-user-token')
  await mp.callWxMethod('setStorageSync', 'agency.opening.story.v1', true)
  await mp.callWxMethod('setStorageSync', 'agency.onboarding.paused.v1.theme-qa-user', true)
  await mp.callWxMethod('removeStorageSync', 'agency.theme.manual.v1.theme-qa-user') // fresh: no manual pick
  await mp.reLaunch('/pages/index/index')
  for (let i = 0; i < 20; i++) { await wait(500); page = await mp.currentPage(); if (await page.$('.journey-nav')) break }
  assert.ok(await page.$('.journey-nav'), 'Must land in the signed-in space')
  const hour = new Date().getHours()
  const expected = hour >= 5 && hour < 10 ? 'theme-light' : hour >= 16 && hour < 19 ? 'theme-dawn' : (hour >= 19 || hour < 5) ? 'theme-dark' : 'theme-forest'
  const stage = await page.$('.preview-stage')
  const cls = await stage.attribute('class')
  console.log('local hour:', hour, '| expected:', expected)
  assert.ok(cls.includes(expected), 'Auto theme follows the time of day: expected ' + expected + ' got ' + cls)
  await mp.screenshot({ path: path.join(out, 'auto-' + expected + '.png') })
  // manual pick stops the automatic switching
  await (await page.$('[data-tab="settings"]')).tap(); await wait(300)
  await (await page.$('.setting-row')).tap(); await wait(400)
  await (await page.$('[data-theme="lavender"]')).tap(); await wait(600)
  const infoAfterPick = await mp.callWxMethod('getStorageInfoSync')
  console.log('storage keys after pick:', JSON.stringify(infoAfterPick.keys))
  const chosenCard = await page.$('[data-theme="lavender"][aria-pressed="true"]')
  console.log('lavender chosen in UI:', !!chosenCard)
  const keysAfterPick = infoAfterPick.keys.map(k => String(k).trim())
  assert.ok(keysAfterPick.includes('agency.theme.manual.v1:theme-qa-user'), 'Manual pick is recorded locally: ' + JSON.stringify(keysAfterPick))
  const footer = await page.$('.appearance-footer')
  await (await (await footer.$('components\\/ActionButton')).$('button')).tap(); await wait(300)
  const cls2 = await (await page.$('.preview-stage')).attribute('class')
  assert.ok(cls2.includes('theme-lavender'), 'Manual pick wins after choosing: ' + cls2)
  await mp.screenshot({ path: path.join(out, 'manual-lavender.png') })
  console.log(JSON.stringify({ passed: true, hour, auto: expected, manual: 'theme-lavender' }))
})().catch(e => { console.error(e.stack); process.exitCode = 1 }).finally(async () => {
  if (!mp) return
  try {
    for (const key of keys) {
      const saved = backups.get(key)
      if (saved && saved.exists) await mp.callWxMethod('setStorageSync', key, saved.value)
      else await mp.callWxMethod('removeStorageSync', key)
    }
    if (mocked) await mp.restoreWxMethod('request')
    await mp.evaluate(() => { delete getApp().__themeQA })
    await mp.reLaunch('/pages/index/index')
  } finally { await mp.disconnect() }
})

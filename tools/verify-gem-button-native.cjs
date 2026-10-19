// Verify the conversation gem button across all six themes; all requests mocked, storage restored.
const auto = require('../output/native-sdk/node_modules/miniprogram-automator')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const wait = ms => new Promise(r => setTimeout(r, ms))
const out = path.resolve('output/gem-button')
const ids = ['light','dark','dawn','forest','lavender','minimal']
const keys = ['agency.session','agency.opening.story.v1','agency.onboarding.paused.v1.theme-qa-user','agency.onboarding.v3.theme-qa-user']
const backups = new Map(), results = []
let mp, page, mocked = false
;(async () => {
  await fs.mkdir(out, { recursive: true })
  mp = await auto.connect({ wsEndpoint: process.env.AGENCY_QA_WS || 'ws://127.0.0.1:9430' })
  const savedKeys = (await mp.callWxMethod('getStorageInfoSync')).keys
  for (const key of keys) backups.set(key, { exists: savedKeys.includes(key), value: await mp.callWxMethod('getStorageSync', key) })
  await mp.evaluate(() => {
    getApp().__themeQA = { theme: 'light', hasIssue: true, calls: [], writes: [], user: { id: 'theme-qa-user', theme: 'light', ai_consent: false, save_chat: false, support_style: 'listen' } }
  })
  await mp.mockWxMethod('request', function (options) {
    const qa = getApp().__themeQA, route = options.url.split('/api')[1] || '', method = options.method || 'GET'
    qa.calls.push(method + ' ' + route)
    const issue = { id: 'gem-issue', title: '探索适合自己的工作与生活', concerns: ['direction'], exploration_intent: 'direction', stage: 'unsure', background: '', constraints: [], life_contexts: [], support_style: 'listen', actual_question: '', focus_response: '想把时间留给有意义的事情', version: 1, created_at: '2026-10-18T00:00:00Z', updated_at: '2026-10-18T00:00:00Z', ended_at: null, feedback: [], card: { title: '找到愿意亲自度过的生活', options: [], constraints: [], confirmed: [], hypotheses: [], unknowns: [], next_step: '' } }
    let data = null, statusCode = 200
    if (route === '/config') data = { dev_auth: true, wechat_auth: false, ai_mode: 'demo' }
    else if (route === '/me') { if (method === 'PUT') { qa.user = { ...qa.user, ...options.data }; qa.writes.push(options.data) } data = qa.user }
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
  await mp.reLaunch('/pages/index/index')
  for (let i = 0; i < 20; i++) {
    await wait(500)
    page = await mp.currentPage()
    if (await page.$('.journey-nav')) break
  }
  assert.ok(await page.$('.journey-nav'), 'Must land in the signed-in space')
  for (const id of ids) {
    // switch theme via the appearance sheet
    await (await page.$('[data-tab="settings"]')).tap(); await wait(300)
    await (await page.$('.setting-row')).tap(); await wait(400)
    const cards = await page.$$('.theme-card')
    assert.equal(cards.length, 6)
    const choice = await page.$('[data-theme="' + id + '"]')
    await choice.tap(); await wait(400)
    // close appearance sheet
    const footer = await page.$('.appearance-footer')
    await (await (await footer.$('components\\/ActionButton')).$('button')).tap(); await wait(300)
    // back to home tab where the gem button is visible
    await (await page.$('[data-tab="now"]')).tap(); await wait(400)
    const stage = await page.$('.preview-stage')
    assert.match(await stage.attribute('class'), new RegExp('theme-' + id))
    const gem = await page.$('.nav-conversation .tab-icon-frame')
    assert.ok(gem, 'Gem button present in ' + id)
    const g = { ...await gem.offset(), ...await gem.size() }
    // circle check: width equals height, keep the shape constraint
    assert.ok(Math.abs(g.width - g.height) <= 1, 'Gem must stay circular in ' + id + ' (' + g.width + 'x' + g.height + ')')
    assert.strictEqual(g.width, 58, 'Gem keeps its 58px diameter in ' + id)
    // label stays readable next to the gem before tapping away
    const label = await page.$('.nav-conversation .nav-label')
    assert.ok(label, 'Gem label present in ' + id)
    // press feedback: tap and capture the awaken state mid-animation
    const chatTab = await page.$('.nav-conversation')
    await chatTab.tap(); await wait(90)
    await mp.screenshot({ path: path.join(out, id + '-press.png') })
    await wait(400)
    // chat hides the tabbar; the chat header home button returns to the home tab
    await (await page.$('.chat-header-button')).tap(); await wait(400)
    assert.ok(await page.$('.journey-nav'), 'Home button restores the tab bar in ' + id)
    results.push({ id, width: g.width, height: g.height })
    await mp.screenshot({ path: path.join(out, id + '-gem.png') })
    console.log('shot ' + id)
  }
  await fs.writeFile(path.join(out, 'report.json'), JSON.stringify({ passed: true, gem: results }, null, 2))
  console.log(JSON.stringify({ passed: true, gem: results }))
})().catch(e => { console.error(e.stack); process.exitCode = 1 }).finally(async () => {
  if (!mp) return
  try {
    for (const [key, saved] of backups) { if (saved.exists) await mp.callWxMethod('setStorageSync', key, saved.value); else await mp.callWxMethod('removeStorageSync', key) }
    if (mocked) await mp.restoreWxMethod('request')
    await mp.evaluate(() => { delete getApp().__themeQA })
    await mp.reLaunch('/pages/index/index')
  } finally { await mp.disconnect() }
})

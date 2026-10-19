// Verify the drawer new-conversation gem CTA across themes; all requests mocked, storage restored.
const auto = require('../output/native-sdk/node_modules/miniprogram-automator')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const wait = ms => new Promise(r => setTimeout(r, ms))
const out = path.resolve('output/drawer-cta')
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
  for (let i = 0; i < 20; i++) { await wait(500); page = await mp.currentPage(); if (await page.$('.journey-nav')) break }
  assert.ok(await page.$('.journey-nav'), 'Must land in the signed-in space')
  for (const id of ids) {
    // switch theme via the appearance sheet
    await (await page.$('[data-tab="settings"]')).tap(); await wait(300)
    await (await page.$('.setting-row')).tap(); await wait(400)
    const choice = await page.$('[data-theme="' + id + '"]')
    await choice.tap(); await wait(400)
    const footer = await page.$('.appearance-footer')
    await (await (await footer.$('components\\/ActionButton')).$('button')).tap(); await wait(300)
    await (await page.$('[data-tab="now"]')).tap(); await wait(400)
    const stage = await page.$('.preview-stage')
    assert.match(await stage.attribute('class'), new RegExp('theme-' + id))
    // open the drawer via the chat menu (summary action) — the automation IDE
    // blocks taps that go through showHistory's request chain; menu actions set
    // the drawer state directly, then we switch to the list view inside.
    const chatTab = await page.$('.nav-conversation')
    await chatTab.tap(); await wait(600)
    const chatButtons = await page.$$('.chat-header-button')
    assert.ok(chatButtons.length >= 3, 'Chat header visible for drawer entry in ' + id)
    await chatButtons[2].tap(); await wait(500) // "会话管理" opens chat-menu
    const menuItems = await page.$$('.chat-menu-item')
    assert.ok(menuItems.length >= 2, 'Chat menu opened in ' + id + ' (items: ' + menuItems.length + ')')
    await menuItems[1].tap(); await wait(700) // "整理当前会话" sets drawer='summary'
    const drawer = await page.$('components\\ConversationDrawer .workspace-drawer')
    assert.ok(drawer, 'Drawer opens in ' + id)
    // switch to the list view where the CTA lives
    const listTab = await page.$('components\\ConversationDrawer .drawer-tabs button')
    await listTab.tap(); await wait(500)
    const cta = await page.$('components\\ConversationDrawer .primary.new-conversation')
    assert.ok(cta, 'New-conversation CTA present in ' + id)
    const c = { ...await cta.offset(), ...await cta.size() }
    // wide horizontal CTA: much wider than tall, inside the drawer
    const drawerBox = { ...await drawer.offset(), ...await drawer.size() }
    assert.ok(c.width >= c.height * 2, 'CTA stays a wide horizontal button in ' + id + ' (' + c.width + 'x' + c.height + ')')
    assert.ok(c.width > drawerBox.width * .7, 'CTA spans the panel in ' + id)
    assert.ok(c.height >= 50, 'CTA keeps a comfortable primary height in ' + id)
    await mp.screenshot({ path: path.join(out, id + '-drawer.png') })
    // press feedback: tap the CTA mid-ignite (opens a draft chat)
    await cta.tap(); await wait(90)
    await mp.screenshot({ path: path.join(out, id + '-press.png') })
    await wait(400)
    // the draft chat hides the drawer; go home via the header for the next cycle
    await (await page.$('.chat-header-button')).tap(); await wait(500)
    await (await page.$('[data-tab="now"]')).tap(); await wait(300)
    results.push({ id, width: c.width, height: c.height })
    console.log('shot ' + id)
  }
  await fs.writeFile(path.join(out, 'report.json'), JSON.stringify({ passed: true, cta: results }, null, 2))
  console.log(JSON.stringify({ passed: true, cta: results }))
})().catch(e => { console.error(e.stack); process.exitCode = 1 }).finally(async () => {
  if (!mp) return
  try {
    for (const [key, saved] of backups) { if (saved.exists) await mp.callWxMethod('setStorageSync', key, saved.value); else await mp.callWxMethod('removeStorageSync', key) }
    if (mocked) await mp.restoreWxMethod('request')
    await mp.evaluate(() => { delete getApp().__themeQA })
    await mp.reLaunch('/pages/index/index')
  } finally { await mp.disconnect() }
})

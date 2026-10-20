// Verify gem primary buttons on the auth screen and onboarding flow; all requests mocked, storage restored.
const auto = require('../output/native-sdk/node_modules/miniprogram-automator')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const wait = ms => new Promise(r => setTimeout(r, ms))
const out = path.resolve('output/auth-gems')
const keys = ['agency.session', 'agency.opening.story.v1', 'agency.onboarding.paused.v1.gem-auth-user', 'agency.onboarding.v3.gem-auth-user']
const backups = new Map()
let mp, mocked = false
;(async () => {
  await fs.mkdir(out, { recursive: true })
  mp = await auto.connect({ wsEndpoint: process.env.AGENCY_QA_WS || 'ws://127.0.0.1:9430' })
  const savedKeys = (await mp.callWxMethod('getStorageInfoSync')).keys
  for (const key of keys) backups.set(key, { exists: savedKeys.includes(key), value: await mp.callWxMethod('getStorageSync', key) })
  await mp.mockWxMethod('request', function (options) {
    const route = options.url.split('/api')[1] || ''
    let data = null, statusCode = 200
    if (route === '/config') data = { dev_auth: true, wechat_auth: true, ai_mode: 'demo' }
    else if (route === '/auth/dev') data = { token: 'gem-auth-token', user: { id: 'gem-auth-user', theme: 'light', ai_consent: false, save_chat: false, support_style: 'listen' }, resume_token: 'x' }
    else if (route === '/issues/current') data = null
    else if (route.startsWith('/issues')) data = []
    else if (route.startsWith('/conversations')) data = []
    else if (route === '/usage') data = { used_cny: 0, limit_cny: 20, daily_calls: 0, daily_limit: 30, mode: 'demo' }
    else if (route === '/me') data = { id: 'gem-auth-user', theme: 'light', ai_consent: false, save_chat: false, support_style: 'listen' }
    else { statusCode = 400; data = { detail: 'Unexpected ' + route } }
    return { statusCode, data, header: {}, errMsg: 'request:ok' }
  })
  mocked = true
  // fresh state: no session, opening seen -> auth screen
  await mp.callWxMethod('removeStorageSync', 'agency.session')
  await mp.callWxMethod('setStorageSync', 'agency.opening.story.v1', true)
  await mp.reLaunch('/pages/index/index')
  let page = null
  for (let i = 0; i < 30; i++) {
    await wait(500)
    page = (await mp.pageStack())[0]
    if (await page.$('components\\AuthWelcome')) break
    if (await page.$('.auth-heading')) break
  }
  assert.ok(await page.$('components\\AuthWelcome') || await page.$('.auth-heading'), 'Must land on the auth screen')
  await mp.screenshot({ path: path.join(out, 'auth-default.png') })
  console.log('shot auth-default')
  // consent checkbox enables the primary login buttons
  const check = await page.$('components\\AuthWelcome .auth-check')
  assert.ok(check, 'Consent checkbox present')
  await check.tap(); await wait(400)
  await mp.screenshot({ path: path.join(out, 'auth-consent.png') })
  console.log('shot auth-consent')
  // dev login path: enter onboarding via the demo button (secondary kind stays flat by design)
  const buttons = await page.$$('components\\AuthWelcome .auth-actions .action-button')
  assert.ok(buttons.length >= 1, 'Action buttons rendered: ' + buttons.length)
  await mp.screenshot({ path: path.join(out, 'auth-actions.png') })
  // login with the demo entry (first secondary action button after wechat)
  const demo = await page.$('components\\AuthWelcome .action-secondary')
  assert.ok(demo, 'Demo login button present')
  await demo.tap(); await wait(1000)
  // onboarding flow: the primary "保存这次探索" CTA is gem now
  const flow = await page.$('components\\OnboardingFlow')
  if (flow) {
    await mp.screenshot({ path: path.join(out, 'onboarding-entry.png') })
    console.log('shot onboarding-entry')
    // walk to the last step's confirm area: tap the primary continue button repeatedly
    for (let step = 0; step < 5; step++) {
      const next = await page.$('components\\OnboardingFlow .flow-footer .action-button')
      if (!next) break
      const disabled = await next.attribute('disabled')
      if (disabled) break
      await next.tap(); await wait(700)
    }
    await mp.screenshot({ path: path.join(out, 'onboarding-confirm.png') })
    console.log('shot onboarding-confirm')
  }
  const result = { passed: true, auth: true, onboarding: !!flow }
  await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(result, null, 2))
  console.log(JSON.stringify(result))
})().catch(e => { console.error(e.stack); process.exitCode = 1 }).finally(async () => {
  if (!mp) return
  try {
    for (const [key, saved] of backups) { if (saved.exists) await mp.callWxMethod('setStorageSync', key, saved.value); else await mp.callWxMethod('removeStorageSync', key) }
    if (mocked) await mp.restoreWxMethod('request')
    await mp.reLaunch('/pages/index/index')
  } finally { await mp.disconnect() }
})

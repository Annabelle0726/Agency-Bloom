// Isolated WeChat simulator capture for onboarding step 1.
// Target only output/onboarding-step1/native-project on automation port 9439.
// Every API request is mocked; original simulator storage is restored afterwards.
// Set AGENCY_QA_EMPTY_ONLY=1 for a resting-state screenshot without selecting.
const auto = require('../output/native-sdk/node_modules/miniprogram-automator')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
const root = path.resolve(__dirname, '..')
const out = path.join(root, 'output/onboarding-step1')
const prefix = process.env.AGENCY_QA_PREFIX || 'before'
// Onboarding intentionally renders Morning Mist by product rule: the six-theme
// palette applies inside the authenticated personal space. Icon palette
// coverage for all six themes lives in tests/themes.test.ts.
const theme = 'light'
const uid = 'onboarding-step1-qa-user'
const draftKey = 'agency.onboarding.v3.' + uid
const keys = ['agency.session', 'agency.opening.story.v1', draftKey, 'agency.onboarding.paused.v1.' + uid]
let mp, page, mocked = false
const backups = new Map()
const exceptions = []

async function fresh() {
  page = await mp.currentPage()
  return page
}
async function until(check, label) {
  for (let index = 0; index < 60; index++) {
    try { await fresh(); if (await check()) return } catch (error) { if (index === 59) throw error }
    await wait(220)
  }
  throw Error(label)
}
async function flow() {
  const component = await page.$('components\\/OnboardingFlow')
  assert.ok(component, 'OnboardingFlow missing')
  return component
}
async function shot(name) {
  await fs.mkdir(out, { recursive: true })
  await mp.screenshot({ path: path.join(out, prefix + '-' + name + '.png') })
}

async function launch() {
  await mp.evaluate(value => { getApp().__onboardingStep1QA = { theme: value, calls: [] } }, theme)
  await mp.callWxMethod('removeStorageSync', 'agency.onboarding.paused.v1.' + uid)
  await mp.callWxMethod('setStorageSync', 'agency.session', 'onboarding-step1-qa-token')
  await mp.callWxMethod('setStorageSync', 'agency.opening.story.v1', true)
  const form = {
    title: '', concerns: [], exploration_intent: '', stage: 'unsure',
    background: '', constraints: [], life_contexts: [], support_style: '', actual_question: '', focus_response: '',
  }
  await mp.callWxMethod('setStorageSync', draftKey, { version: 3, form, step: 0, savedAt: Date.now() })
  await mp.reLaunch('/pages/index/index')
  // reLaunch can briefly leave the old page visible; wait for the fresh Step 1
  // card list instead of accepting any OnboardingFlow instance. SelectionCard
  // is a custom component, so query it inside OnboardingFlow.
  await until(async () => {
    const component = await page.$('components\\/OnboardingFlow')
    return !!component && (await component.$$('components\\/SelectionCard')).length === 7
  }, 'Onboarding step 1 did not render')
  await wait(500)
}

;(async () => {
  await fs.mkdir(out, { recursive: true })
  mp = await auto.connect({ wsEndpoint: process.env.AGENCY_QA_WS || 'ws://127.0.0.1:9439', connectionTimeout: 60000 })
  mp.on('exception', error => exceptions.push(String(error)))
  await fresh()
  const storedKeys = (await mp.callWxMethod('getStorageInfoSync')).keys
  for (const key of keys) backups.set(key, { exists: storedKeys.includes(key), value: await mp.callWxMethod('getStorageSync', key) })

  await mp.mockWxMethod('request', function (options) {
    const qa = getApp().__onboardingStep1QA
    const route = (options.url.split('/api')[1] || '').split('?')[0]
    qa.calls.push((options.method || 'GET') + ' ' + route)
    const user = { id: 'onboarding-step1-qa-user', theme: qa.theme, save_chat: false, ai_consent: false, support_style: 'listen' }
    let data = null, statusCode = 200
    if (route === '/config') data = { dev_auth: true, wechat_auth: false, ai_mode: 'demo' }
    else if (route === '/me') data = user
    else if (route === '/issues/current') data = null
    else if (route === '/issues' && (options.method || 'GET') === 'GET') data = []
    else if (route === '/conversations' && (options.method || 'GET') === 'GET') data = []
    else if (route === '/usage') data = { used_cny: 0, limit_cny: 20, daily_calls: 0, daily_limit: 30, mode: 'demo' }
    else { statusCode = 400; data = { detail: 'Unexpected QA route ' + route } }
    return { statusCode, data, header: {}, errMsg: 'request:ok' }
  })
  mocked = true

  const info = await mp.systemInfo()
  await launch()
  await fresh()
  let current = await flow()
  const cards = await current.$$('components\\/SelectionCard')
  assert.equal(cards.length, 7, 'Every starting concern remains available')
  const firstCard = cards[0]
  const firstButton = await firstCard.$('button')
  const iconRoot = await firstCard.$('.selection-icon-tile')
  assert.ok(iconRoot, 'The option icon tile is rendered')
  const svgIcon = await iconRoot.$('components\\/SvgIcon')
  assert.ok(svgIcon, 'The option uses the shared SvgIcon component')
  const iconImage = await svgIcon.$('image')
  assert.ok(iconImage, 'The icon uses a WeChat image data source')
  assert.match(await iconImage.attribute('src'), /^data:image\/svg\+xml;base64,/, 'The icon is an offline themed SVG data source')
  // Move focus away from the first card so the empty state is not captured
  // with a lingering simulator press.
  const heading = await current.$('.flow-heading')
  if (heading) { await heading.tap(); await wait(220) }
  await shot(theme + '-empty')
  if (!process.env.AGENCY_QA_EMPTY_ONLY) {
    await firstButton.tap()
    await wait(420)
    const savedSelection = await mp.callWxMethod('getStorageSync', draftKey)
    assert.deepEqual(savedSelection.form.concerns, ['direction'], 'Selection is saved to the local draft')
    await shot(theme + '-selected')
    await fresh(); current = await flow()
    await (await current.$('.flow-scroll')).scrollTo(0, 9999)
    await wait(300)
    await shot(theme + '-bottom')
  }

  const calls = await mp.evaluate(() => getApp().__onboardingStep1QA.calls)
  const report = {
    passed: true,
    prefix,
    theme,
    device: { model: info.model, width: info.windowWidth, height: info.windowHeight },
    cards: 7,
    modelRequests: calls.filter(route => route.includes('/chat')).length,
    exceptions,
  }
  await fs.writeFile(path.join(out, prefix + '-report.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report))
})().catch(async error => {
  console.error(error.stack)
  try { await shot('failure') } catch { /* The page may be unavailable. */ }
  try { console.error('QA calls', await mp.evaluate(() => getApp().__onboardingStep1QA)) } catch { /* Leave original error. */ }
  process.exitCode = 1
}).finally(async () => {
  if (!mp) return
  try {
    for (const [key, saved] of backups) {
      if (saved.exists) await mp.callWxMethod('setStorageSync', key, saved.value)
      else await mp.callWxMethod('removeStorageSync', key)
    }
    if (mocked) await mp.restoreWxMethod('request')
    await mp.evaluate(() => { delete getApp().__onboardingStep1QA })
    await mp.reLaunch('/pages/index/index')
  } finally { await mp.disconnect() }
})

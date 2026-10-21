// Isolated WeChat simulator capture for onboarding step 2.
// Target the copied project on automation port 9440; every API request is mocked.
// Set AGENCY_QA_PREFIX=before|after. Original simulator storage is restored afterwards.
const auto = require('../output/native-sdk/node_modules/miniprogram-automator')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
const root = path.resolve(__dirname, '..')
const out = path.join(root, 'output/onboarding-step2')
const prefix = process.env.AGENCY_QA_PREFIX || 'before'
const theme = 'light'
const uid = 'onboarding-step2-qa-user'
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
async function geometry() {
  const component = await flow()
  const selectors = ['.flow-chrome', '.flow-heading', '.flow-title', '.flow-scroll', '.flow-step-1', '.exploration-starts', '.free-writing', '.flow-footer']
  const values = {}
  for (const selector of selectors) {
    const node = await component.$(selector)
    if (!node) { values[selector] = null; continue }
    values[selector] = { offset: await node.offset(), size: await node.size() }
  }
  return values
}
async function launchStepOne() {
  await mp.evaluate(value => { getApp().__onboardingStep2QA = { theme: value, calls: [] } }, theme)
  await mp.callWxMethod('removeStorageSync', 'agency.onboarding.paused.v1.' + uid)
  await mp.callWxMethod('setStorageSync', 'agency.session', 'onboarding-step2-qa-token')
  await mp.callWxMethod('setStorageSync', 'agency.opening.story.v1', true)
  const form = {
    title: '', concerns: [], exploration_intent: '', stage: 'unsure',
    background: '', constraints: [], life_contexts: [], support_style: '',
    actual_question: '', focus_response: '',
  }
  await mp.callWxMethod('setStorageSync', draftKey, { version: 3, form, step: 0, savedAt: Date.now() })
  await mp.reLaunch('/pages/index/index')
  await until(async () => {
    const component = await page.$('components\\/OnboardingFlow')
    return !!component && (await component.$$('components\\/SelectionCard')).length === 7
  }, 'Onboarding step 1 did not render')
  await wait(500)
}

async function chooseUncertaintyAndContinue() {
  let current = await flow()
  // Start from the bottom of Step 1 to prove Step 2 still opens at its title.
  const stepOneScroll = await current.$('.flow-scroll')
  await stepOneScroll.scrollTo(0, 9999)
  await wait(300)
  current = await flow()
  const cards = await current.$$('components\\/SelectionCard')
  assert.equal(cards.length, 7, 'Every starting concern remains available')
  await (await cards[6].$('button')).tap()
  await wait(300)
  current = await flow()
  const continueButton = (await current.$$('components\\/ActionButton'))[0]
  await (await continueButton.$('button')).tap()
  await until(async () => {
    const component = await page.$('components\\/OnboardingFlow')
    return !!component && !!(await component.$('.flow-step-1'))
  }, 'Onboarding step 2 did not render')
  await wait(500)
}

;(async () => {
  await fs.mkdir(out, { recursive: true })
  mp = await auto.connect({ wsEndpoint: process.env.AGENCY_QA_WS || 'ws://127.0.0.1:9440', connectionTimeout: 60000 })
  mp.on('exception', error => exceptions.push(String(error)))
  mp.on('console', entry => console.log('MP console', JSON.stringify(entry)))
  await fresh()
  const storedKeys = (await mp.callWxMethod('getStorageInfoSync')).keys
  for (const key of keys) backups.set(key, { exists: storedKeys.includes(key), value: await mp.callWxMethod('getStorageSync', key) })

  await mp.mockWxMethod('request', function (options) {
    const app = typeof getApp === 'function' ? getApp() : null
    const qa = app && app.__onboardingStep2QA
    const route = (options.url.split('/api')[1] || '').split('?')[0]
    if (qa) qa.calls.push((options.method || 'GET') + ' ' + route)
    const user = { id: 'onboarding-step2-qa-user', theme: qa ? qa.theme : 'light', save_chat: false, ai_consent: false, support_style: 'listen' }
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
  await launchStepOne()
  await chooseUncertaintyAndContinue()
  await fresh()
  let current = await flow()
  const initialGeometry = await geometry()
  const heading = await current.$('.flow-heading')
  if (heading) { await heading.tap(); await wait(220) }
  await shot('step2-empty')
  console.log('captured empty')

  const starts = await current.$$('components\\/SelectionCard')
  assert.equal(starts.length, 3, 'The uncertain path keeps three gentle directions')
  const stepText = await (await current.$('.flow-step-1')).text()
  console.log('read three directions')
  for (const copy of ['聊聊最近的感受', '更了解自己', '看看新的可能', '或者，用自己的话说']) {
    assert.ok(stepText.includes(copy), 'Missing gentle copy: ' + copy)
  }
  assert.equal(await current.$('.branch-question'), null, 'The unsure path must not repeat the heading as a questionnaire prompt')
  for (const card of starts) {
    const tile = await card.$('.selection-icon-tile')
    assert.ok(tile, 'Every direction has a quiet icon tile')
    const icon = await tile.$('components\\/SvgIcon')
    assert.ok(icon, 'Every direction uses the shared SvgIcon component')
    const image = await icon.$('image')
    assert.ok(image, 'Every direction uses the shared image-rendered icon')
    assert.match(await image.attribute('src'), /^data:image\/svg\+xml;base64,/, 'Direction icons are offline themed SVG data sources')
  }

  const free = await current.$('.free-textarea')
  assert.ok(free, 'Free writing must be a real, visible textarea')
  assert.match(await free.attribute('placeholder'), /最近反复想到/, 'Free writing needs a concrete placeholder')
  assert.equal(await free.value(), '')
  const firstButton = await starts[0].$('button')
  await firstButton.tap(); await wait(320)
  assert.equal(await firstButton.attribute('aria-pressed'), 'true', 'A direction has a visible selected state')
  await shot('step2-selected')

  const written = '最近总在想，自己真正想做的是什么'
  await free.input(written); await wait(320)
  assert.equal(await firstButton.attribute('aria-pressed'), 'false', 'Typing switches from the suggestion to the free response')
  assert.equal(await free.value(), written)
  const savedWriting = await mp.callWxMethod('getStorageSync', draftKey)
  assert.equal(savedWriting.form.focus_response, written, 'Free writing remains in the local draft')
  if (heading) { await heading.tap(); await wait(260) }
  await shot('step2-writing')

  const scroll = await current.$('.flow-scroll')
  await scroll.scrollTo(0, 9999); await wait(350)
  await shot('step2-bottom')

  // Enter Step 3 from the bottom, then return and confirm the step-keyed
  // scroll container opens at the complete Step 2 title again.
  current = await flow()
  const continueButton = (await current.$$('components\\/ActionButton'))[0]
  await (await continueButton.$('button')).tap(); await wait(500)
  current = await flow()
  assert.ok(await current.$('.flow-step-2'), 'Step 3 is reachable')
  const stepThreeScroll = await current.$('.flow-scroll')
  await stepThreeScroll.scrollTo(0, 9999); await wait(300)
  await (await current.$('.flow-back')).tap(); await wait(500)
  current = await flow()
  assert.ok(await current.$('.flow-step-1'), 'Step 2 is reachable after returning')
  await wait(250)
  const returnedGeometry = await geometry()
  await shot('step2-returned')
  assert.equal(await (await current.$('.free-textarea')).value(), written, 'Returning keeps the written response')

  const header = returnedGeometry['.flow-heading']
  const scrollBox = returnedGeometry['.flow-scroll']
  if (!header || !scrollBox) throw Error('Missing geometry for title or scroll container')
  assert.ok(Number(header.offset.top) >= Number(scrollBox.offset.top) - 1, 'Title must not sit above the scroll viewport')
  assert.ok(Number(header.offset.top) <= Number(scrollBox.offset.top) + 40, 'Step 2 must reopen at the top of its title')

  const calls = await mp.evaluate(() => (getApp().__onboardingStep2QA || { calls: [] }).calls)
  const report = {
    passed: true,
    prefix,
    theme,
    device: { model: info.model, width: info.windowWidth, height: info.windowHeight },
    directions: 3,
    freeWriting: true,
    titleVisibleAfterReturn: true,
    initialGeometry,
    returnedGeometry,
    modelRequests: calls.filter(route => route.includes('/chat')).length,
    exceptions,
  }
  await fs.writeFile(path.join(out, prefix + '-report.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report))
})().catch(async error => {
  console.error(error.stack)
  try { await shot('failure') } catch { /* The page may be unavailable. */ }
  try { console.error('QA calls', await mp.evaluate(() => getApp().__onboardingStep2QA)) } catch { /* Leave original error. */ }
  process.exitCode = 1
}).finally(async () => {
  if (!mp) return
  try {
    for (const [key, saved] of backups) {
      if (saved.exists) await mp.callWxMethod('setStorageSync', key, saved.value)
      else await mp.callWxMethod('removeStorageSync', key)
    }
    if (mocked) await mp.restoreWxMethod('request')
    await mp.evaluate(() => { delete getApp().__onboardingStep2QA })
    await mp.reLaunch('/pages/index/index')
  } finally { await mp.disconnect() }
})

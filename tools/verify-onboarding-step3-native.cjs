// Isolated WeChat simulator QA for onboarding step 3 (life context).
// Run only against the separately copied project in output/onboarding-step3/native-project
// on automation port 9439. Every API request is mocked; no server or model is called.
const auto = require('../output/native-sdk/node_modules/miniprogram-automator')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
const root = path.resolve(__dirname, '..')
const out = path.join(root, 'output/onboarding-step3')
const theme = process.env.AGENCY_QA_THEME || 'light'
const shotNames = theme === 'light'
  ? { empty: '01-life-tags-default', selected: '02-life-tags-selected', bottom: '03-life-tags-bottom', report: 'report.json' }
  : { empty: '04-' + theme + '-empty', selected: '05-' + theme + '-selected', bottom: '06-' + theme + '-bottom', report: 'report-' + theme + '.json' }
const uid = 'onboarding-step3-qa-v2'
const draftKey = 'agency.onboarding.v3.' + uid
const keys = ['agency.session', 'agency.opening.story.v1', draftKey, 'agency.onboarding.paused.v1.' + uid]
const titles = ['学习或备考', '求职', '在职工作', '职业转换', '自由职业', '创业或经营', '内容创作', '家庭与照护', '休整与重新出发', '退休生活', '其他']
let mp, page, mocked = false
const backups = new Map()
const exceptions = []
async function fresh() {
  if (!mp) {
    mp = await auto.connect({ wsEndpoint: process.env.AGENCY_QA_WS || 'ws://127.0.0.1:9439', connectionTimeout: 60000 })
    mp.on('exception', error => exceptions.push(String(error)))
  }
  page = await mp.currentPage()
  return page
}
async function until(check, label) {
  for (let index = 0; index < 50; index++) {
    try { await fresh(); if (await check()) return } catch (error) { if (index === 49) throw error }
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
  await mp.screenshot({ path: path.join(out, name + '.png') })
}
async function box(item) {
  const offset = await item.offset()
  const size = await item.size()
  return { left: Number(offset.left), top: Number(offset.top), width: Number(size.width), height: Number(size.height) }
}
function overlaps(a, b) {
  return a.left < b.left + b.width && b.left < a.left + a.width &&
    a.top < b.top + b.height && b.top < a.top + a.height
}
async function continueButton(component) {
  const action = await component.$('.flow-footer components\\/ActionButton')
  assert.ok(action, 'Continue action is rendered')
  const button = await action.$('button')
  assert.ok(button, 'Continue button is rendered')
  return button
}
;(async () => {
  await fs.mkdir(out, { recursive: true })
  await fresh()
  const storedKeys = (await mp.callWxMethod('getStorageInfoSync')).keys
  for (const key of keys) backups.set(key, { exists: storedKeys.includes(key), value: await mp.callWxMethod('getStorageSync', key) })
  await mp.evaluate((value, id) => { getApp().__onboardingStep3QA = { theme: value, uid: id, calls: [] } }, theme, uid)
  await mp.mockWxMethod('request', function (options) {
    const qa = getApp().__onboardingStep3QA
    const route = (options.url.split('/api')[1] || '').split('?')[0]
    qa.calls.push((options.method || 'GET') + ' ' + route)
    const user = { id: qa.uid, theme: qa.theme, save_chat: false, ai_consent: false, support_style: 'listen' }
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
  await mp.callWxMethod('removeStorageSync', 'agency.onboarding.paused.v1.' + uid)
  await mp.callWxMethod('setStorageSync', 'agency.session', 'onboarding-step3-qa-token')
  await mp.callWxMethod('setStorageSync', 'agency.opening.story.v1', true)
  const form = {
    title: '', concerns: ['direction'], exploration_intent: 'direction', stage: 'unsure',
    background: '', constraints: [], life_contexts: [], support_style: '', actual_question: '', focus_response: '',
  }
  await mp.callWxMethod('setStorageSync', draftKey, { version: 3, form, step: 2, savedAt: Date.now() })
  await mp.reLaunch('/pages/index/index')
  await until(async () => {
    const component = await page.$('components\\/OnboardingFlow')
    return !!component && !!(await component.$('.life-tag'))
  }, 'Onboarding step 3 did not render')
  await wait(450)
  await fresh()
  let current = await flow()
  const info = await mp.systemInfo()

  const heading = await current.$('.flow-heading')
  const headingBox = await box(heading)
  assert.ok(headingBox.top >= 0, 'Heading is cut off at the top')
  assert.match(await heading.text(), /你最近的生活，\s*主要围绕哪些事？/)
  assert.match(await heading.text(), /选与你有关的，也可以用自己的话补充。/)

  const tags = await current.$$('.life-tag')
  assert.equal(tags.length, 11, 'Every life context must remain available')
  const labels = await Promise.all(tags.map(tag => tag.text()))
  assert.deepEqual(labels.map(label => label.trim()), titles)
  const emptyBoxes = await Promise.all(tags.map(box))
  for (const item of emptyBoxes) {
    assert.ok(item.height >= 48 && item.height <= 54, 'Tag height stays in the 48–54 range: ' + item.height)
    assert.ok(item.left >= 0 && item.left + item.width <= info.windowWidth + 1, 'Tag overflows horizontally')
  }
  for (let first = 0; first < emptyBoxes.length; first++) {
    for (let second = first + 1; second < emptyBoxes.length; second++) {
      assert.equal(overlaps(emptyBoxes[first], emptyBoxes[second]), false, 'Tags overlap')
    }
  }
  const rest = await current.$('.life-tag[data-context="rest"]')
  const restBox = await box(rest)
  assert.ok(restBox.height <= 54, '休整与重新出发 must stay on one line')
  const maxTagWidth = Math.max(...emptyBoxes.map(item => item.width))
  assert.ok(maxTagWidth <= 280, 'Every natural-width tag fits a 320px screen with 20px page padding')
  assert.match(await (await current.$('.context-status')).text(), /之后也可以再调整。/)
  assert.equal(await current.$$('.context-bubble').then(items => items.length), 0, 'Old circular bubbles were removed')
  assert.equal(await current.$$('.life-tag .svg-icon').then(items => items.length), 0, 'Tags have no decorative icons')
  await shot(shotNames.empty)

  // An empty selection may continue, exactly as before the redesign.
  await (await continueButton(current)).tap(); await wait(340)
  await fresh(); current = await flow()
  assert.match(await (await current.$('.flow-title')).text(), /此刻，你希望\s*得到怎样的帮助/)
  await (await current.$('.flow-back')).tap(); await wait(340)
  await fresh(); current = await flow()
  assert.equal((await current.$$('.life-tag')).length, 11, 'Returning keeps every tag available')
  assert.equal((await current.$$('.life-tag.chosen')).length, 0, 'Empty selection was preserved')

  const studying = await current.$('.life-tag[data-context="studying"]')
  const searching = await current.$('.life-tag[data-context="searching"]')
  await studying.tap(); await wait(240)
  await searching.tap(); await wait(260)
  await fresh(); current = await flow()
  const selectedTags = await current.$$('.life-tag.chosen')
  assert.equal(selectedTags.length, 2, 'Multiple life contexts stay selectable')
  assert.match(await (await current.$('.context-status')).text(), /已选 2 项 · 之后也可以再调整。/)
  const selectedBoxes = await Promise.all((await current.$$('.life-tag')).map(box))
  selectedBoxes.forEach((item, index) => {
    assert.ok(Math.abs(item.width - emptyBoxes[index].width) < 1, 'Selection must not change tag width: ' +
      emptyBoxes[index].width + ' -> ' + item.width)
    assert.ok(Math.abs(item.height - emptyBoxes[index].height) < 1, 'Selection must not change tag height: ' +
      emptyBoxes[index].height + ' -> ' + item.height)
  })
  await shot(shotNames.selected)

  await (await current.$('.life-tag[data-context="studying"]')).tap(); await wait(220)
  await fresh(); current = await flow()
  assert.equal((await current.$$('.life-tag.chosen')).length, 1, 'Tapping a selected tag deselects only it')
  let saved = await mp.callWxMethod('getStorageSync', draftKey)
  assert.deepEqual(saved.form.life_contexts, ['searching'])

  // Rapid taps must not lose or duplicate state.
  const other = await current.$('.life-tag[data-context="other"]')
  await other.tap(); await other.tap(); await wait(180)
  await fresh(); current = await flow()
  saved = await mp.callWxMethod('getStorageSync', draftKey)
  assert.deepEqual(saved.form.life_contexts, ['searching'], 'Rapid double tap returns to the original state')

  // Return navigation keeps the selection.
  await (await current.$('.flow-back')).tap(); await wait(320)
  await fresh()
  assert.equal(await page.$('.life-tag'), null, 'Back leaves step 3')
  const nextButton = await continueButton(current)
  await nextButton.tap(); await wait(320)
  await fresh(); current = await flow()
  assert.equal((await current.$$('.life-tag.chosen')).length, 1, 'Selection survives back and forward')

  // Reload restores the draft and keeps the selected tag.
  await mp.reLaunch('/pages/index/index')
  await until(async () => {
    const component = await page.$('components\\/OnboardingFlow')
    return !!component && !!(await component.$('.life-tag'))
  }, 'Restored onboarding missing')
  await wait(400); await fresh(); current = await flow()
  assert.equal((await current.$$('.life-tag.chosen')).length, 1, 'Selection restores from the local draft')

  // The real input area accepts text and saves it in the existing draft.
  const background = await current.$('.context-input')
  await background.input('最近在照顾家人，也想慢慢找回自己的工作节奏')
  await wait(220)
  saved = await mp.callWxMethod('getStorageSync', draftKey)
  assert.equal(saved.form.background, '最近在照顾家人，也想慢慢找回自己的工作节奏')
  const inputs = await current.$$('.context-input')
  assert.equal(inputs.length, 2, 'The existing background and constraints inputs remain available')

  // Everything remains reachable above the fixed footer.
  await (await current.$('.flow-scroll')).scrollTo(0, 9999); await wait(350)
  const footerTop = (await box(await current.$('.flow-footer'))).top
  const finalInput = await box(inputs[1])
  assert.ok(finalInput.top + finalInput.height <= footerTop + 2, 'The last input can scroll fully above the footer')
  for (const tag of await current.$$('.life-tag')) {
    const item = await box(tag)
    if (item.top < footerTop) assert.ok(item.top + item.height <= footerTop + 2, 'A tag is hidden behind the footer')
  }
  await shot(shotNames.bottom)

  await (await current.$('.flow-scroll')).scrollTo(0, 0); await wait(220)
  assert.deepEqual(exceptions, [])
  const calls = await mp.evaluate(() => getApp().__onboardingStep3QA.calls)
  assert.equal(calls.some(route => route.includes('/chat')), false, 'No model request was sent')
  const report = {
    passed: true,
    theme,
    device: { model: info.model, width: info.windowWidth, height: info.windowHeight },
    tags: tags.length,
    tagHeight: [Math.min(...emptyBoxes.map(item => item.height)), Math.max(...emptyBoxes.map(item => item.height))],
    maxTagWidth,
    tagColumns: new Set(emptyBoxes.map(item => Math.round(item.top))).size,
    selection: ['searching'],
    emptySelectionContinues: true,
    draftRestored: true,
    inputReachable: true,
    modelRequests: 0,
    exceptions,
  }
  await fs.writeFile(path.join(out, shotNames.report), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report))
})().catch(async error => {
  console.error(error.stack)
  try { await shot('failure') } catch { /* The page may be unavailable. */ }
  try {
    console.error('QA calls', await mp.evaluate(() => getApp().__onboardingStep3QA))
    const body = await page.$('.body-copy')
    if (body) console.error('QA body', await body.text())
    console.error('QA exceptions', exceptions)
  } catch { /* Leave the original failure as the primary error. */ }
  process.exitCode = 1
}).finally(async () => {
  if (!mp) return
  try {
    for (const [key, saved] of backups) {
      if (saved.exists) await mp.callWxMethod('setStorageSync', key, saved.value)
      else await mp.callWxMethod('removeStorageSync', key)
    }
    if (mocked) await mp.restoreWxMethod('request')
    await mp.evaluate(() => { delete getApp().__onboardingStep3QA })
    await mp.reLaunch('/pages/index/index')
  } finally { await mp.disconnect() }
})

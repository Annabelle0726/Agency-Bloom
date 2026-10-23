// Disposable tourist project only: Mock API 8030, automation 9450.
// Build with VITE_API_BASE_URL=http://127.0.0.1:8030/api, then --prepare.
const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict')
const auto = require('../output/native-sdk/node_modules/miniprogram-automator')
const root = path.resolve(__dirname, '..'), out = path.join(root, 'output/moments'), project = path.join(out, 'native-project')
const wait = ms => new Promise(r => setTimeout(r, ms))
let mp, page, auth
const errors = []
async function api(route, method = 'GET', body) {
  const r = await fetch('http://127.0.0.1:8030' + route, { method, headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: auth } : {}) }, body: body ? JSON.stringify(body) : undefined })
  assert.ok(r.ok, route + ': ' + r.status); return r.status === 204 ? null : r.json()
}
async function refresh() {
  if (mp) await mp.disconnect()
  mp = await auto.connect({ wsEndpoint: 'ws://127.0.0.1:9450' }); mp.on('exception', e => errors.push(String(e)))
  page = (await mp.pageStack())[0]
}
async function until(check, label) {
  for (let i = 0; i < 60; i++) { await refresh(); if (page && await check()) return; await wait(200) }
  throw Error(label)
}
const component = name => page.$(name.replaceAll('/', '\\/'))
async function moment() {
  return await component('pages/index/views/BloomMoment') || await (await component('pages/index/views/DiscoverView'))?.$('pages\\/index\\/views\\/BloomMoment')
}
async function tap(selector) { const e = await (await moment()).$(selector); assert.ok(e, selector); await e.tap() }
async function shot(name) { await mp.callWxMethod('pageScrollTo', { scrollTop: 0, duration: 0 }); await wait(200); await mp.screenshot({ path: path.join(out, name + '.png') }) }
async function discover() {
  await until(async () => !!await component('pages/index/views/AppTabbar'), 'Workspace navigation')
  const nav = await component('pages/index/views/AppTabbar')
  await (await nav.$('[data-tab="discover"]')).tap()
  await until(async () => !!await moment(), 'Moment in Discover')
}
async function enter(theme, consent = true) {
  const seed = await api('/qa/seed?theme=' + theme + '&consent=' + consent, 'POST'); auth = 'Bearer ' + seed.token
  await refresh(); await mp.callWxMethod('setStorageSync', 'agency.session', seed.token)
  await mp.callWxMethod('setStorageSync', 'agency.theme.manual.v1:' + seed.user_id, true)
  await mp.callWxMethod('setStorageSync', 'agency.onboarding.paused.v1.' + seed.user_id, true)
  await mp.callWxMethod('reLaunch', { url: '/pages/index/index' }); await until(async () => !!await component('pages/index/views/AppTabbar'), 'Homepage with no exploration')
  assert.equal(await moment(), null, 'Moment does not render on Home'); await discover()
  return seed
}
(async () => {
  await fs.mkdir(out, { recursive: true })
  if (process.argv.includes('--prepare')) {
    const source = path.join(root, 'apps/miniprogram/dist/build/mp-weixin')
    assert.match(await fs.readFile(path.join(source, 'pages/index/useIndexPage.js'), 'utf8'), /127\.0\.0\.1:8030/)
    await fs.cp(source, project, { recursive: true })
    const config = JSON.parse(await fs.readFile(path.join(project, 'project.config.json'), 'utf8'))
    config.libVersion = JSON.parse(await fs.readFile(path.join(root, 'project.config.json'), 'utf8')).libVersion
    config.appid = 'touristappid'; config.projectname = 'Bloom Moment QA'; config.setting.urlCheck = false
    await fs.writeFile(path.join(project, 'project.config.json'), JSON.stringify(config, null, 2)); return
  }
  assert.equal(JSON.parse(await fs.readFile(path.join(project, 'project.config.json'), 'utf8')).appid, 'touristappid')
  assert.equal((await api('/qa/status')).provider, 'moments-isolated')
  await enter('forest', false)
  assert.equal((await api('/api/usage')).daily_calls, 0)
  await shot('forest-unopened'); await tap('[data-moment="open"]')
  await until(async () => !!await (await moment()).$('[data-moment="consent"]'), 'Separate consent')
  await tap('[data-moment="consent"]')
  await until(async () => !!await (await moment()).$('.moment-question'), 'First moment')
  assert.equal((await api('/api/usage')).daily_calls, 1)
  await shot('forest-opened')
  const first = (await api('/api/moments/today')).moment.id
  await mp.callWxMethod('reLaunch', { url: '/pages/index/index' })
  await discover(); await until(async () => !!await (await moment()).$('.moment-question'), 'Retained after relaunch')
  assert.equal((await api('/api/usage')).daily_calls, 1)
  assert.equal((await api('/api/moments/today')).moment.id, first)
  await tap('[data-moment="dismiss"]')
  await until(async () => (await api('/api/moments/today')).moment.dismissed, 'Dismissed')
  assert.equal((await api('/api/usage')).daily_calls, 1)
  await shot('dismissed')
  await tap('[data-moment="another"]')
  await until(async () => (await api('/api/usage')).daily_calls === 2 && !!await (await moment()).$('.moment-question'), 'Explicit second')
  await tap('[data-moment="personalize"]'); await tap('[data-moment="another"]')
  await until(async () => !!await (await moment()).$('.moment-source'), 'Verified dated quote')
  await shot('personal-echo')
  await tap('[data-moment="chat"]')
  await until(async () => !!await component('pages/index/chat/ChatComposer'), 'Unsent independent draft')
  const composer = await component('pages/index/chat/ChatComposer')
  assert.match(await (await composer.$('.chat-input')).value(), /AI 给出的邀请/)
  assert.equal((await api('/api/conversations')).length, 0)
  assert.equal((await api('/api/usage')).daily_calls, 3)
  await shot('chat-draft')
  for (const theme of ['dark', 'light', 'dawn', 'lavender', 'minimal']) {
    await enter(theme); await tap('[data-moment="open"]')
    await until(async () => !!await (await moment()).$('.moment-question'), 'Theme content: ' + theme)
    await shot(theme + '-opened')
    const bounds = await (await (await moment()).$('.bloom-moment')).size()
    const info = await mp.systemInfo(); assert.ok(bounds.width <= info.windowWidth)
    const photo = await (await moment()).$('.moment-picture')
    if (photo) { const size = await photo.size(); assert.ok(size.width <= 90 && size.height <= 105) }
  }
  const info = await mp.systemInfo(); assert.deepEqual(errors, [])
  const report = { passed: true, width: info.windowWidth, height: info.windowHeight, model: info.model,
    flows: ['Moment only in Discover', 'bounded photography', 'no call on view', 'consent', 'open', 'daily replay', 'dismiss without call', 'explicit another', 'opt-in dated quote', 'unsent separate draft', 'six themes'], exceptions: errors, paidRequests: 0 }
  await fs.writeFile(path.join(out, 'report-' + Date.now() + '.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report))
})().catch(e => { console.error(e); process.exitCode = 1 }).finally(async () => { if (mp) await mp.disconnect(); if (process.exitCode) process.exit(process.exitCode) })

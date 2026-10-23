// Isolated tourist project and disposable Mock API only. Never attach the personal project.
// Build VITE_API_BASE_URL=http://127.0.0.1:8029/api into output/home-refinements/native-project,
// run --prepare, start mock-discovery-api.py on 8029, and CLI auto this project on 9449.
const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict')
const auto = require('../output/native-sdk/node_modules/miniprogram-automator')
const root = path.resolve(__dirname, '..'), out = path.join(root, 'output/home-refinements')
const project = path.join(out, 'native-project'), wait = ms => new Promise(r => setTimeout(r, ms))
let mp, page
const errors = []
async function fresh() {
  if (mp) await mp.disconnect()
  mp = await auto.connect({ wsEndpoint: 'ws://127.0.0.1:9449' })
  mp.on('exception', e => errors.push(String(e)))
  page = (await mp.pageStack())[0]
}
async function until(check, label) {
  for (let i = 0; i < 70; i++) { await fresh(); if (page && await check()) return; await wait(200) }
  throw Error(label)
}
const component = name => page.$(name.replaceAll('/', '\\/'))
const home = () => component('pages/index/views/HomeView')
const bar = () => component('pages/index/views/AppTabbar')
async function tap(parent, selector) { const e = await parent.$(selector); assert.ok(e, selector); await e.tap() }
async function centered(frame, glyph) {
  const a = await frame.offset(), as = await frame.size(), b = await glyph.offset(), bs = await glyph.size()
  return { dx: b.left + bs.width / 2 - a.left - as.width / 2,
    dy: b.top + bs.height / 2 - a.top - as.height / 2, frame: as, image: bs }
}
async function iconMeasurements() {
  const view = await home(), result = []
  for (const frame of await view.$$('.focus-symbol')) {
    const icon = await frame.$('components\\/SvgIcon')
    result.push({ area: 'focus', ...await centered(frame, await icon.$('.svg-icon')) })
  }
  const arrow = await view.$('.mission-arrow'), arrowIcon = await arrow.$('components\\/SvgIcon')
  result.push({ area: 'mission', ...await centered(arrow, await arrowIcon.$('.svg-icon')) })
  const top = await component('pages/index/views/AppTopbar')
  for (const button of await top.$$('.chat-header-button')) result.push({ area: 'topbar', ...await centered(button, await button.$('image')) })
  for (const frame of await (await bar()).$$('.tab-icon-frame')) result.push({ area: 'tabbar', ...await centered(frame, await frame.$('image')) })
  return result
}
async function seed(theme) {
  const r = await fetch('http://127.0.0.1:8029/qa/seed?theme=' + theme, { method: 'POST' })
  assert.ok(r.ok); const data = await r.json()
  await fresh()
  await mp.callWxMethod('setStorageSync', 'agency.session', data.token)
  await mp.callWxMethod('setStorageSync', 'agency.theme.manual.v1:' + data.user_id, true)
  await mp.callWxMethod('setStorageSync', 'agency.onboarding.paused.v1.' + data.user_id, true)
  await mp.callWxMethod('reLaunch', { url: '/pages/index/index' })
  await until(async () => !!await home(), 'Home loads')
}
;(async () => {
  await fs.mkdir(out, { recursive: true })
  if (process.argv.includes('--prepare')) {
    assert.match(await fs.readFile(path.join(project, 'pages/index/useIndexPage.js'), 'utf8'), /127\.0\.0\.1:8029/)
    const config = JSON.parse(await fs.readFile(path.join(project, 'project.config.json'), 'utf8'))
    config.appid = 'touristappid'; config.projectname = 'Agency Bloom Home Refinements QA'
    config.setting.urlCheck = false; config.setting.compileHotReLoad = false
    await fs.writeFile(path.join(project, 'project.config.json'), JSON.stringify(config, null, 2))
    return
  }
  assert.equal(JSON.parse(await fs.readFile(path.join(project, 'project.config.json'), 'utf8')).appid, 'touristappid')
  const status = await (await fetch('http://127.0.0.1:8029/qa/status')).json()
  assert.equal(status.provider, 'discovery-isolated'); assert.equal(status.paid_requests, 0)
  const baseline = process.argv.includes('--baseline'), reports = []
  for (const theme of baseline ? ['dark'] : ['dark', 'light']) {
    await seed(theme); await mp.pageScrollTo(0)
    const device = await mp.systemInfo(), icons = await iconMeasurements()
    const view = await home()
    await mp.pageScrollTo(100000); await wait(250)
    await mp.screenshot({ path: path.join(out, `${baseline ? 'before' : 'after'}-${theme}.png`) })
    const report = { theme, model: device.model, width: device.windowWidth, height: device.windowHeight, icons }
    reports.push(report)
    await fs.writeFile(path.join(out, baseline ? 'before.json' : 'after.json'), JSON.stringify(reports, null, 2))
    for (const icon of icons) assert.ok(Math.abs(icon.dx) < .75 && Math.abs(icon.dy) < .75, JSON.stringify(icon))
    if (!baseline) {
      const tags = await view.$$('.focus-tag'), colors = await Promise.all(tags.map(t => t.style('color')))
      assert.equal(new Set(colors).size, 3, 'Each focus tag has a different color')
      assert.equal((await view.$$('.quote-mark')).length, 2)
      assert.equal(await view.$('.quote-rule'), null)
      const text = await (await view.$('.quote-text')).text()
      const quoteId = await mp.callWxMethod('getStorageSync', 'agency.home.quote.v1')
      await tap(await bar(), '[data-tab="plan"]'); await wait(200); await fresh()
      await tap(await bar(), '[data-tab="now"]'); await until(async () => !!await home(), 'Return home')
      assert.equal(await (await (await home()).$('.quote-text')).text(), text, 'Tab switches do not rotate')
      const canShow = await mp.evaluate(() => typeof getApp().onShow === 'function')
      assert.ok(canShow, 'Native App exposes the foreground lifecycle handler')
      await mp.evaluate(() => { getApp().onShow({ scene: 1001, path: 'pages/index/index' }); return true })
      await until(async () => (await (await home()).$('.quote-text')).text().then(t => t !== text), 'Foreground refreshes quote')
      assert.notEqual(await mp.callWxMethod('getStorageSync', 'agency.home.quote.v1'), quoteId)
      report.tagColors = colors; report.foregroundRotation = true; report.tabSwitchPreservesQuote = true
    }
  }
  assert.deepEqual(errors, [])
  await fs.writeFile(path.join(out, baseline ? 'before.json' : 'after.json'), JSON.stringify({ reports, exceptions: errors, paidRequests: 0 }, null, 2))
  console.log(JSON.stringify(reports))
})().catch(e => { console.error(e); process.exitCode = 1 }).finally(async () => { if (mp) await mp.disconnect() })

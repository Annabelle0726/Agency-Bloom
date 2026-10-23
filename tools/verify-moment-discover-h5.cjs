// Auxiliary H5 acceptance only; this does not replace WeChat simulator acceptance.
// Run tools/mock-moments-api.py (8030), then an H5 server built with that API on 5187.
// PLAYWRIGHT_MODULE may point to an existing installation; no browser or package install.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const assert = require('node:assert/strict'), fs = require('node:fs/promises'), path = require('node:path')
const out = path.resolve(__dirname, '../output/moments/refined')
const apiBase = 'http://127.0.0.1:8030'
let browser, page, auth = '', calls = []
const errors = [], images = [], results = []
async function api(route, method = 'GET', body) {
  const response = await fetch(apiBase + route, { method, headers: { Authorization: auth, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
  assert.ok(response.ok, route + ': ' + response.status)
  return response.status === 204 ? null : response.json()
}
async function discover() {
  await page.locator('[data-tab="discover"]').click()
  await page.locator('[data-moment="root"]').waitFor()
  await page.waitForFunction(() => document.querySelector('[data-moment="root"]')?.getAttribute('aria-busy') === 'false')
}
async function enter(theme, consent = true, width = 390) {
  await page.setViewportSize({ width, height: 844 })
  const seed = await api('/qa/seed?theme=' + theme + '&consent=' + consent, 'POST'); auth = 'Bearer ' + seed.token
  await page.goto('http://127.0.0.1:5187/'); await page.waitForFunction(() => typeof uni !== 'undefined')
  await page.evaluate(s => {
    uni.setStorageSync('agency.session', s.token)
    uni.setStorageSync('agency.theme.manual.v1:' + s.user_id, true)
    uni.setStorageSync('agency.onboarding.paused.v1.' + s.user_id, true)
  }, seed)
  calls = []; await page.reload(); await page.locator('[data-tab="discover"]').waitFor()
  assert.equal(await page.locator('[data-moment="root"]').count(), 0)
  assert.equal(calls.filter(c => c.includes('/moments/')).length, 0, 'Home must not read or generate Moments')
  await discover(); assert.equal((await api('/api/usage')).daily_calls, 0)
}
async function shot(name) {
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForFunction(() => !document.querySelector('[data-moment="root"]')?.classList.contains('is-arriving'))
  await page.waitForFunction(() => [...document.querySelectorAll('uni-image.moment-image > div, uni-image.discovery-photo > div, uni-image.discover-atmosphere > div')].every(image => image.style.backgroundImage.includes('url')), null, { timeout: 20000 })
  await page.screenshot({ path: path.join(out, name + '.png') })
  if (['forest-unopened', 'forest-opened', 'width-320'].includes(name)) await page.screenshot({ path: path.join(out, name + '-full.png'), fullPage: true })
}
async function layout(label) {
  const bounds = await page.evaluate(() => {
    const root = document.querySelector('[data-moment="root"]'), image = document.querySelector('.moment-picture')
    const r = root.getBoundingClientRect(), i = image?.getBoundingClientRect()
    return { width: innerWidth, document: document.documentElement.scrollWidth, left: r.left, right: r.right,
      photo: i ? { width: i.width, height: i.height } : null,
      pictureCount: document.querySelectorAll('.moment-image').length }
  })
  assert.ok(bounds.document <= bounds.width, label + ': page overflow')
  assert.ok(bounds.left >= 0 && bounds.right <= bounds.width, label + ': card overflow')
  if (bounds.photo) { assert.ok(bounds.photo.width < 90); assert.ok(bounds.photo.height < 105) }
  results.push({ label, ...bounds })
}
(async () => {
  assert.equal((await api('/qa/status')).provider, 'moments-isolated')
  await fs.mkdir(out, { recursive: true })
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_BROWSER ? { executablePath: process.env.PLAYWRIGHT_BROWSER } : {}) })
  page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => { if (request.url().startsWith(apiBase)) calls.push(request.method() + ' ' + new URL(request.url()).pathname) })
  page.on('requestfailed', request => { if (request.resourceType() === 'image') images.push(new URL(request.url()).pathname) })
  // Forward only the isolated fixture API; allow CORS for this disposable H5 origin.
  await page.route(apiBase + '/**', async route => {
    const response = await route.fetch()
    await route.fulfill({ response, headers: { ...response.headers(), 'access-control-allow-origin': '*' } })
  })
  await enter('forest', false)
  await layout('forest-unopened'); await shot('forest-unopened')
  const openBounds = await page.locator('[data-moment="open"]').boundingBox(); assert.ok(openBounds)
  await page.mouse.move(openBounds.x + 20, openBounds.y + 20); await page.mouse.down()
  await page.waitForFunction(() => new DOMMatrix(getComputedStyle(document.querySelector('[data-moment="open"]')).transform).m42 > .7)
  await page.screenshot({ path: path.join(out, 'button-pressed.png') })
  await page.mouse.move(1, 1); await page.mouse.up()
  assert.equal((await api('/api/usage')).daily_calls, 0)
  await page.locator('[data-moment="open"]').click(); await page.locator('[data-moment="consent"]').waitFor()
  await shot('consent'); await page.locator('[data-moment="consent"]').click()
  await page.locator('.moment-question').waitFor(); assert.equal((await api('/api/usage')).daily_calls, 1)
  await shot('forest-opened'); await layout('forest-opened')
  const title = await page.locator('.moment-title').textContent(), paragraph = await page.locator('.moment-body').textContent()
  const usedBeforeToggle = (await api('/api/usage')).daily_calls
  await page.locator('[data-moment="toggle"]').click()
  assert.equal(await page.locator('[data-moment="toggle"]').getAttribute('aria-expanded'), 'false')
  assert.equal(await page.locator('.moment-body').count(), 0); assert.equal(await page.locator('[data-moment="root"] .companion-bot').count(), 0)
  assert.equal(await page.locator('.moment-title').textContent(), title); await shot('collapsed')
  await page.locator('[data-moment="toggle"]').click(); assert.equal(await page.locator('.moment-body').textContent(), paragraph)
  assert.equal((await api('/api/usage')).daily_calls, usedBeforeToggle)
  await page.locator('[data-moment="about"]').click(); await page.locator('[data-moment="disclosure"]').waitFor()
  assert.match(await page.locator('[data-moment="disclosure"]').textContent(), /由 AI 生成/)
  await page.locator('[data-moment="about"]').click(); assert.equal(await page.locator('[data-moment="disclosure"]').count(), 0)
  const bot = page.locator('[data-moment="root"] .companion-bot'); await bot.scrollIntoViewIfNeeded()
  const face = await bot.boundingBox(); assert.ok(face)
  await page.mouse.move(face.x + face.width / 2, face.y + face.height / 2)
  await page.waitForFunction(() => !!document.querySelector('.gaze-pupil'))
  await page.mouse.move(face.x + face.width - 2, face.y + face.height / 2)
  await page.waitForFunction(() => (() => { const eye = document.querySelector('.gaze-pupil'); return eye && new DOMMatrix(getComputedStyle(eye).transform).m41 > .7 })())
  await shot('gaze-right'); await page.mouse.move(1, 1)
  await page.waitForFunction(() => (() => { const eye = document.querySelector('.gaze-pupil'); return eye && Math.abs(new DOMMatrix(getComputedStyle(eye).transform).m41) < .01 })())
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.waitForFunction(() => !document.querySelector('.gaze-layer'))
  await page.emulateMedia({ reducedMotion: 'no-preference' }); await page.waitForFunction(() => !!document.querySelector('.gaze-layer'))
  const first = (await api('/api/moments/today')).moment.id
  await page.reload(); await page.locator('[data-tab="discover"]').waitFor(); await discover(); await page.locator('.moment-question').waitFor()
  assert.equal((await api('/api/moments/today')).moment.id, first)
  assert.equal((await api('/api/usage')).daily_calls, 1)
  const preserved = await page.locator('.moment-question').textContent()
  await page.route(apiBase + '/api/moments/*/dismiss', route => route.fulfill({ status: 503, json: { detail: 'fixture failure' }, headers: { 'access-control-allow-origin': '*' } }), { times: 1 })
  await page.locator('[data-moment="dismiss"]').click(); await page.locator('[data-moment="notice"]').waitFor()
  assert.equal(await page.locator('.moment-question').textContent(), preserved)
  await shot('dismiss-failed'); assert.equal((await api('/api/usage')).daily_calls, 1)
  await page.locator('[data-moment="recover"]').click(); await page.locator('[data-moment="notice"]').waitFor({ state: 'detached' })
  await page.locator('[data-moment="dismiss"]').click(); await page.locator('.moment-question').waitFor({ state: 'detached' })
  assert.equal((await api('/api/usage')).daily_calls, 1); await shot('dismissed')
  await page.locator('[data-moment="another"]').click(); await page.locator('.moment-question').waitFor()
  assert.equal((await api('/api/usage')).daily_calls, 2)
  await page.locator('[data-moment="personalize"]').click(); await page.locator('[data-moment="another"]').click()
  await page.locator('.moment-source').waitFor(); await shot('echo')
  await page.locator('[data-moment="chat"]').click(); await page.locator('.chat-input').waitFor()
  assert.match(await page.locator('.chat-input textarea').inputValue(), /AI 给出的邀请/)
  assert.equal((await api('/api/conversations')).length, 0)
  assert.equal((await api('/api/usage')).daily_calls, 3)
  const welcomeBot = page.locator('.chat-welcome .companion-bot'); await welcomeBot.scrollIntoViewIfNeeded()
  const welcomeBounds = await welcomeBot.boundingBox(); assert.ok(welcomeBounds)
  await page.mouse.move(welcomeBounds.x + welcomeBounds.width - 2, welcomeBounds.y + welcomeBounds.height / 2)
  await page.waitForFunction(() => { const eye = document.querySelector('.chat-welcome .gaze-pupil'); return eye && new DOMMatrix(getComputedStyle(eye).transform).m41 > .4 })
  await page.screenshot({ path: path.join(out, 'chat-welcome.png') }); await page.mouse.move(1, 1)
  await page.locator('.send-button').click(); await page.locator('.message-row.assistant').last().waitFor()
  await page.waitForFunction(() => !!document.querySelector('.message-row.assistant .gaze-layer'))
  const replyBot = page.locator('.message-row.assistant .companion-bot').last(); await replyBot.scrollIntoViewIfNeeded()
  const replyBounds = await replyBot.boundingBox(); assert.ok(replyBounds)
  await page.mouse.move(replyBounds.x + replyBounds.width - 2, replyBounds.y + replyBounds.height / 2)
  await page.waitForFunction(() => { const eye = document.querySelector('.message-row.assistant .gaze-pupil'); return eye && new DOMMatrix(getComputedStyle(eye).transform).m41 > .5 })
  await page.screenshot({ path: path.join(out, 'chat-reply.png') })
  assert.equal((await api('/api/conversations')).length, 1)
  assert.equal((await api('/api/usage')).daily_calls, 4)
  for (const theme of ['light', 'dark', 'dawn', 'lavender', 'minimal']) {
    await enter(theme); await shot(theme + '-unopened')
    await page.locator('[data-moment="open"]').click(); await page.locator('.moment-question').waitFor()
    await layout(theme); await shot(theme + '-opened')
  }
  for (const width of [320, 360, 430]) {
    await page.setViewportSize({ width, height: 740 }); await layout('width-' + width); await shot('width-' + width)
  }
  await page.emulateMedia({ reducedMotion: 'reduce' }); await layout('reduced-motion')
  await page.route(apiBase + '/api/moments/open', route => route.fulfill({ status: 402, json: { detail: '本次 AI 额度已用完' }, headers: { 'access-control-allow-origin': '*' } }), { times: 1 })
  const callsBefore = calls.filter(c => c === 'POST /api/moments/open').length
  const textBefore = await page.locator('.moment-question').textContent()
  await page.locator('[data-moment="another"]').click(); await page.locator('[data-moment="notice"]').waitFor()
  assert.match(await page.locator('[data-moment="notice"]').textContent(), /额度已用完/)
  assert.equal(await page.locator('.moment-question').textContent(), textBefore)
  assert.equal(calls.filter(c => c === 'POST /api/moments/open').length, callsBefore + 1)
  assert.equal((await api('/api/usage')).daily_calls, 1)
  await shot('budget-exhausted')
  assert.deepEqual(errors, [])
  await fs.writeFile(path.join(out, 'report.json'), JSON.stringify({ passed: true, platform: 'H5 only', results, errors, imageFailures: images, paidRequests: 0 }, null, 2))
  console.log(JSON.stringify({ passed: true, cases: results.length, imageFailures: images.length, paidRequests: 0 }))
})().catch(error => { console.error(error); process.exitCode = 1 }).finally(async () => { if (browser) await browser.close() })

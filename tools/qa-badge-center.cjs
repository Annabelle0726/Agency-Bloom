// Measure camera-icon centering inside the badge geometrically.
const auto = require('../output/native-sdk/node_modules/miniprogram-automator')
const wait = ms => new Promise(r => setTimeout(r, ms))
;(async () => {
  const mp = await auto.connect({ wsEndpoint: 'ws://127.0.0.1:9430' })
  try {
    await mp.mockWxMethod('request', function (options) {
      const route = options.url.split('/api')[1] || ''
      const issue = { id: 'dbg-issue', title: '探索', concerns: [], exploration_intent: 'direction', stage: 'unsure', background: '', constraints: [], life_contexts: [], support_style: 'listen', actual_question: '', focus_response: '', version: 1, created_at: '2026-10-18T00:00:00Z', updated_at: '2026-10-18T00:00:00Z', ended_at: null, feedback: [], card: { title: '', options: [], constraints: [], confirmed: [], hypotheses: [], unknowns: [], next_step: '' } }
      let data = null
      if (route === '/config') data = { dev_auth: true, wechat_auth: false, ai_mode: 'demo' }
      else if (route === '/me') data = { id: 'dbg-user', theme: 'dark', ai_consent: false, save_chat: false, support_style: 'listen' }
      else if (route === '/issues/current') data = issue
      else if (route.startsWith('/issues')) data = [issue]
      else if (route.startsWith('/conversations')) data = []
      else if (route === '/usage') data = { used_cny: 0, limit_cny: 20, daily_calls: 0, daily_limit: 30, mode: 'demo' }
      else data = { detail: 'miss ' + route }
      return { statusCode: 200, data, header: {}, errMsg: 'request:ok' }
    })
    await mp.callWxMethod('setStorageSync', 'agency.session', 'dbg-token')
    await mp.callWxMethod('setStorageSync', 'agency.opening.story.v1', true)
    await mp.callWxMethod('setStorageSync', 'agency.onboarding.paused.v1.dbg-user', true)
    await mp.reLaunch('/pages/index/index')
    for (let i = 0; i < 20; i++) { await wait(500); if (await (await mp.currentPage()).$('.journey-nav')) break }
    const page = await mp.currentPage()
    await (await page.$('[data-tab="settings"]')).tap(); await wait(700)
    const badge = await page.$('.settings-content .avatar-edit-badge')
    let iconBox = null
    let icon = null
    for (const sel of ['.avatar-edit-badge .svg-icon', '.avatar-edit-badge svg-icon', '.avatar-edit-badge image']) {
      try { icon = await page.$(sel); if (icon) { console.log('matched page-level:', sel); break } } catch { /* next */ }
    }
    if (!icon) { console.log('no icon selector matched'); return }
    const b = { ...await badge.offset(), ...await badge.size() }
    iconBox = { ...await icon.offset(), ...await icon.size() }
    const bc = { x: b.left + b.width / 2, y: b.top + b.height / 2 }
    const ic = { x: iconBox.left + iconBox.width / 2, y: iconBox.top + iconBox.height / 2 }
    const dx = Math.abs(bc.x - ic.x), dy = Math.abs(bc.y - ic.y)
    console.log('badge:', JSON.stringify(b))
    console.log('icon :', JSON.stringify(iconBox))
    console.log('center delta:', dx.toFixed(2), dy.toFixed(2))
    console.log(dx <= 1 && dy <= 1 ? 'CENTERED (<=1px)' : 'OFF-CENTER')
    await mp.screenshot({ path: 'output/avatar-entry/badge-centering.png' })
  } finally {
    await mp.restoreWxMethod('request')
    try { await mp.callWxMethod('removeStorageSync', 'agency.session'); await mp.callWxMethod('removeStorageSync', 'agency.opening.story.v1'); await mp.callWxMethod('removeStorageSync', 'agency.onboarding.paused.v1.dbg-user') } catch {}
    await mp.disconnect()
  }
})().catch(e => { console.error(e.message); process.exitCode = 1 })

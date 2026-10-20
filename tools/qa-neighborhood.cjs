// Inspect the avatar settings DOM neighborhood for stray elements.
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
    // list the settings-group neighborhood
    const groups = await page.$$('.settings-content .settings-group')
    console.log('settings groups:', groups.length)
    const first = groups[0]
    const kids = await first.$$('view, button, text, image')
    console.log('first group children:', kids.length)
    for (const k of kids.slice(0, 10)) {
      const cls = (await k.attribute('class')) || ''
      console.log(' -', cls.slice(0, 70), '|', JSON.stringify({ ...await k.offset(), ...await k.size() }))
    }
    // anything unexpected inside/around the avatar entry?
    const entry = await page.$('.settings-content .avatar-entry')
    const entryKids = await entry.$$('view, image, text')
    console.log('entry children:', entryKids.length)
    for (const k of entryKids) {
      const cls = (await k.attribute('class')) || ''
      console.log(' * entry child:', cls.slice(0, 60))
    }
    await mp.screenshot({ path: 'output/avatar-entry/neighborhood.png' })
  } finally {
    await mp.restoreWxMethod('request')
    try { await mp.callWxMethod('removeStorageSync', 'agency.session'); await mp.callWxMethod('removeStorageSync', 'agency.opening.story.v1'); await mp.callWxMethod('removeStorageSync', 'agency.onboarding.paused.v1.dbg-user') } catch {}
    await mp.disconnect()
  }
})().catch(e => { console.error(e.message); process.exitCode = 1 })

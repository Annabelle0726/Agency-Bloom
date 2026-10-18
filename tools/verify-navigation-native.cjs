// Native navigation integration: mock requests, restore storage, never send messages.
const auto = require('../output/native-sdk/node_modules/miniprogram-automator')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const wait = ms => new Promise(r => setTimeout(r, ms))
const out = path.resolve(__dirname, '../output/navigation')
let mp, backup, existed, mocked = false
const errors = []
;(async () => {
  await fs.mkdir(out, {recursive:true})
  mp = await auto.connect({wsEndpoint:'ws://127.0.0.1:9430'})
  mp.on('exception', e => errors.push(String(e)))
  existed = (await mp.callWxMethod('getStorageInfoSync')).keys.includes('agency.session')
  backup = await mp.callWxMethod('getStorageSync', 'agency.session')
  await mp.evaluate(() => { getApp().__navQA = {theme:'light', calls:[]} })
  await mp.mockWxMethod('request', function(options) {
    const qa = getApp().__navQA
    const route = options.url.split('/api')[1] || ''
    qa.calls.push(route)
    const issue = {id:'nav-qa-issue', title:'想找到适合自己的方向', concerns:['direction'], exploration_intent:'direction', stage:'unsure', background:'', constraints:[], life_contexts:[], support_style:'listen', actual_question:'', focus_response:'', version:1, created_at:'2026-10-18T00:00:00Z', updated_at:'2026-10-18T00:00:00Z', ended_at:null, feedback:[], card:{title:'',options:[],constraints:[],confirmed:[],hypotheses:[],unknowns:[],next_step:''}}
    let data, statusCode = 200
    if (route === '/config') data = {dev_auth:true,wechat_auth:false,ai_mode:'demo'}
    else if (route === '/me') data = {id:'nav-qa-user',theme:qa.theme,save_chat:false,ai_consent:false,support_style:'listen'}
    else if (route === '/issues/current') data = issue
    else if (route === '/issues') data = [issue]
    else if (route.endsWith('/messages')) data = []
    else if (route === '/usage') data = {used_cny:0,limit_cny:20,daily_calls:0,daily_limit:30,mode:'demo'}
    else {statusCode = 400; data = {detail:'Unexpected QA route'}}
    return {statusCode,data,header:{},errMsg:'request:ok'}
  })
  mocked = true
  await mp.callWxMethod('setStorageSync','agency.session','nav-qa-token')
  for (const theme of ['light','dark']) {
    await mp.evaluate(value => { getApp().__navQA.theme=value }, theme)
    await mp.reLaunch('/pages/index/index'); await wait(900)
    let page = await mp.currentPage()
    const nav = await page.$('.journey-nav')
    assert.ok(nav, 'Signed-in navigation is visible')
    assert.equal((await nav.$$('button')).length, 3)
    const center = await nav.$('[data-tab="chat"] .tab-icon-frame')
    const normal = await nav.$('[data-tab="now"] .tab-icon-frame')
    await mp.screenshot({path:path.join(out,theme+'-nav-debug.png')})
    console.log(JSON.stringify({theme,center:await center.offset(),normal:await normal.offset(),centerSize:await center.size()}))
    assert.ok((await center.offset()).top < (await normal.offset()).top - 10, 'Conversation circle is raised')
    const size = await center.size()
    assert.ok(Math.abs(size.width-size.height)<1, 'Central action is circular')
    await mp.screenshot({path:path.join(out,theme+'-home.png')})
    await (await nav.$('[data-tab="chat"]')).tap(); await wait(500)
    assert.ok(await page.$('.chat-content'))
    assert.ok(await nav.$('[data-tab="chat"].active'))
    const composer = await page.$('.composer')
    assert.ok((await composer.offset()).top + (await composer.size()).height <= (await center.offset()).top - 6, 'Input stays clear of the raised navigation')
    await mp.screenshot({path:path.join(out,theme+'-chat.png')})
    await (await nav.$('[data-tab="settings"]')).tap(); await wait(500)
    assert.ok(await page.$('.settings-content'))
    assert.ok(await nav.$('[data-tab="settings"].active'))
    await mp.screenshot({path:path.join(out,theme+'-settings.png')})
    await (await nav.$('[data-tab="now"]')).tap(); await wait(300)
    assert.ok(await page.$('.workspace'))
    assert.ok(await nav.$('[data-tab="now"].active'))
  }
  assert.deepEqual(errors,[])
  const calls = await mp.evaluate(() => getApp().__navQA.calls)
  assert.equal(calls.some(route => route.includes('/chat')),false)
  const report={passed:true,themes:['light','dark'],navigation:3,backend_requests:0,model_requests:0,errors}
  await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2))
  console.log(JSON.stringify(report))
})().catch(e=>{console.error(e.stack);process.exitCode=1}).finally(async()=>{
  if(!mp) return
  try {
    if(existed) await mp.callWxMethod('setStorageSync','agency.session',backup)
    else if(backup!==undefined) await mp.callWxMethod('removeStorageSync','agency.session')
    if(mocked) await mp.restoreWxMethod('request')
    await mp.evaluate(()=>{delete getApp().__navQA})
    await mp.reLaunch('/pages/index/index')
  } finally {await mp.disconnect()}
})

// Run against the root dev project on port 9430. All requests mocked; original storage restored.
const auto = require('../output/native-sdk/node_modules/miniprogram-automator')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const wait = ms => new Promise(r => setTimeout(r, ms))
const out = path.resolve('output/theme-completion')
const ids = ['light','dark','dawn','forest','lavender','minimal']
const keys = ['agency.session','agency.opening.story.v1','agency.onboarding.paused.v1.theme-qa-user','agency.onboarding.v3.theme-qa-user']
const backups = new Map(), errors = [], results = []
let mp, page, mocked = false
async function launch() { await mp.reLaunch('/pages/index/index'); await wait(850); page = await mp.currentPage() }
async function tab(id) { await (await page.$('[data-tab="'+id+'"]')).tap(); await wait(250) }
async function shot(name) { await mp.screenshot({path:path.join(out,name+'.png')}) }
async function appearance() { await tab('settings'); await (await page.$('.setting-row')).tap(); await wait(250) }
async function closeAppearance() {
  const footer = await page.$('.appearance-footer')
  await (await (await footer.$('components\\/ActionButton')).$('button')).tap(); await wait(250)
}
;(async()=>{
  await fs.mkdir(out,{recursive:true})
  mp = await auto.connect({wsEndpoint:process.env.AGENCY_QA_WS || 'ws://127.0.0.1:9430'})
  mp.on('exception',e=>errors.push(String(e)))
  const savedKeys = (await mp.callWxMethod('getStorageInfoSync')).keys
  for (const key of keys) backups.set(key,{exists:savedKeys.includes(key),value:await mp.callWxMethod('getStorageSync',key)})
  await mp.evaluate(()=>{getApp().__themeQA={theme:'light',hasIssue:true,fail:false,calls:[],writes:[],user:{id:'theme-qa-user',theme:'light',ai_consent:false,save_chat:false,support_style:'listen'}}})
  await mp.mockWxMethod('request',function(options){
    const qa=getApp().__themeQA, route=options.url.split('/api')[1]||'', method=options.method||'GET'
    qa.calls.push(method+' '+route)
    const issue={id:'theme-qa-issue',title:'探索适合自己的工作与生活',concerns:['direction'],exploration_intent:'direction',stage:'unsure',background:'',constraints:[],life_contexts:[],support_style:'listen',actual_question:'',focus_response:'想把时间留给有意义的事情',version:1,created_at:'2026-10-18T00:00:00Z',updated_at:'2026-10-18T00:00:00Z',ended_at:null,feedback:[],card:{title:'找到愿意亲自度过的生活',options:['做一次小规模的尝试'],constraints:[],confirmed:[],hypotheses:[],unknowns:[],next_step:'了解一位从业者的真实工作日'}}
    let data=null,statusCode=200
    if(route==='/config')data={dev_auth:true,wechat_auth:false,ai_mode:'demo'}
    else if(route==='/me'){
      if(method==='PUT'){
        if(qa.fail){statusCode=503;data={detail:'Theme save unavailable'}}
        else {qa.writes.push(options.data);qa.user={...qa.user,...options.data}}
      }
      if(statusCode===200)data=qa.user
    }
    else if(route==='/issues/current')data=qa.hasIssue?issue:null
    else if(route==='/issues')data=qa.hasIssue?[issue]:[]
    else if(route.endsWith('/messages'))data=[]
    else if(route==='/usage')data={used_cny:0,limit_cny:20,daily_calls:0,daily_limit:30,mode:'demo'}
    else {statusCode=400;data={detail:'Unexpected QA request '+route}}
    return {statusCode,data,header:{},errMsg:'request:ok'}
  })
  mocked=true
  await mp.callWxMethod('setStorageSync','agency.session','theme-qa-token')
  await launch()
  const device=await mp.systemInfo()
  for(let index=0;index<ids.length;index++){
    const id=ids[index]
    await appearance()
    assert.equal((await page.$$('.theme-card')).length,6)
    await (await page.$('.appearance-scroll')).scrollTo(0,Math.floor(index/2)*280);await wait(200)
    const choice=await page.$('[data-theme="'+id+'"]')
    const preview=await choice.$('components\\/ThemePreview')
    const source=await (await preview.$('image')).attribute('src')
    await choice.tap();await wait(350)
    assert.equal(await (await page.$('[data-theme="'+id+'"]')).attribute('aria-pressed'),'true')
    const user=await mp.evaluate(()=>getApp().__themeQA.user)
    assert.equal(user.theme,id);assert.equal(user.save_chat,false);assert.equal(user.ai_consent,false)
    assert.equal(user.support_style,'listen')
    if(index===0)await shot('picker-top')
    if(index===5)await shot('picker-bottom')
    const dock=await page.$('.appearance-footer')
    assert.ok((await dock.offset()).top+(await dock.size()).height<=device.windowHeight+1)
    await closeAppearance();await tab('now')
    assert.equal((await page.$$('.journey-nav button')).length,5)
    assert.equal(await (await page.$('.theme-atmosphere image')).attribute('src'),source,'Home and preview must share the artwork')
    assert.ok(await page.$('.home-mission'));assert.ok(await page.$('.home-focus-card'))
    const nav=await page.$('[data-tab="now"] .tab-glyph')
    const icon=await nav.attribute('src')
    results.push({id,source,icon})
    for (const button of await page.$$('.topbar .icon-button')) {
      const glyph=await button.$('.topbar-glyph')
      const b={...await button.offset(),...await button.size()}, g={...await glyph.offset(),...await glyph.size()}
      assert.ok(Math.abs((b.left+b.width/2)-(g.left+g.width/2))<1,'Header SVG horizontally centered')
      assert.ok(Math.abs((b.top+b.height/2)-(g.top+g.height/2))<1,'Header SVG vertically centered')
    }
    console.log('Verified '+id+' home, preview and header alignment')
    await shot(id+'-home')
    await tab('plan');assert.ok(await page.$('.plan-content'));assert.ok(await page.$('.paper-card'))
    if(index===0)await shot('plan')
    await tab('discover');assert.equal((await page.$$('.discovery-card')).length,3)
    if(index===0){
      await shot('discover')
      await (await page.$('[data-discovery="0"]')).tap();await wait(300)
      assert.ok(await page.$('.chat-content'))
      const draft=await (await page.$('.chat-input')).attribute('value')
      assert.match(draft,/赞许/)
    }else await tab('chat')
    const composer=await page.$('.composer'),center=await page.$('[data-tab="chat"] .tab-icon-frame')
    assert.ok((await composer.offset()).top+(await composer.size()).height<=(await center.offset()).top-5,'Composer clears raised action')
    await shot(id+'-chat')
  }
  assert.equal(new Set(results.map(x=>x.icon)).size,6,'All navigation palettes must update')
  const writes=await mp.evaluate(()=>getApp().__themeQA.writes)
  assert.ok(writes.every(body=>Object.keys(body).join(',')==='theme'))
  await launch()
  assert.match(await (await page.$('.preview-stage')).attribute('class'),/theme-minimal/)
  await appearance()
  await mp.evaluate(()=>{getApp().__themeQA.fail=true})
  await (await page.$('[data-theme="dark"]')).tap();await wait(400)
  assert.match(await (await page.$('.preview-stage')).attribute('class'),/theme-minimal/,'Failed save preserves active theme')
  await mp.evaluate(()=>{getApp().__themeQA.fail=false})
  await closeAppearance()
  await mp.callWxMethod('removeStorageSync','agency.session')
  await mp.callWxMethod('setStorageSync','agency.opening.story.v1',true)
  await launch()
  const auth=await page.$('components\\/AuthWelcome')
  assert.ok(auth)
  assert.equal(await (await auth.$('.auth-background')).attribute('src'),results[0].source)
  assert.equal(await page.$('.journey-nav'),null)
  await shot('login-default')
  await mp.callWxMethod('setStorageSync','agency.session','theme-qa-token')
  await mp.callWxMethod('setStorageSync','agency.onboarding.paused.v1.theme-qa-user',true)
  await mp.evaluate(()=>{getApp().__themeQA.hasIssue=false})
  await launch()
  assert.ok(await page.$('.empty-dashboard'))
  await tab('plan');assert.ok(await page.$('.empty-dashboard'))
  await tab('discover');assert.ok(await page.$('.discover-content'))
  await tab('chat');assert.ok(await page.$('components\\/OnboardingFlow'))
  assert.deepEqual(errors,[])
  const calls=await mp.evaluate(()=>getApp().__themeQA.calls)
  assert.equal(calls.some(x=>x.includes('/chat')||x==='POST /issues'),false)
  const report={passed:true,device,themes:results.map(({icon,...rest})=>rest),tabs:5,persistence:true,failedSavePreservesTheme:true,emptyAccount:true,loginUsesDefault:true,backendRequests:0,modelRequests:0,errors}
  await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2))
  console.log(JSON.stringify({passed:true,width:device.windowWidth,height:device.windowHeight,themes:6,tabs:5,errors}))
})().catch(e=>{console.error(e.stack);process.exitCode=1}).finally(async()=>{
  if(!mp)return
  try{
    for(const[key,saved]of backups){if(saved.exists)await mp.callWxMethod('setStorageSync',key,saved.value);else await mp.callWxMethod('removeStorageSync',key)}
    if(mocked)await mp.restoreWxMethod('request')
    await mp.evaluate(()=>{delete getApp().__themeQA})
    await mp.reLaunch('/pages/index/index')
  }finally{await mp.disconnect()}
})

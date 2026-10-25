// Local Mock API on 8029 and this isolated tourist project only. No paid calls.
// Build with VITE_API_BASE_URL=http://127.0.0.1:8029/api into output/home-bloom/native-project.
// Run --prepare, then Developer Tools CLI auto that directory on port 9457.
const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict')
const auto = require('../output/native-sdk/node_modules/miniprogram-automator')
const root = path.resolve(__dirname, '..'), out = path.join(root, 'output/home-bloom')
const project = path.join(out, 'native-project'), errors = [], consoleErrors = []
const wait = ms => new Promise(r => setTimeout(r, ms))
let mp, page, token
async function fresh() {
  if (mp) await mp.disconnect()
  mp = await auto.connect({ wsEndpoint:'ws://127.0.0.1:9457' })
  mp.on('exception', e => errors.push(String(e)))
  mp.on('console', e => { if (e.level === 'error') consoleErrors.push(e.args) })
  page = (await mp.pageStack())[0]
}
async function until(check, label) {
  for (let i=0;i<70;i++) { await fresh(); if (page && await check()) return; await wait(250) }
  throw Error(label)
}
const home = () => page.$('pages\\/index\\/views\\/HomeView')
async function card() { return (await home()).$('components\\/HomeBloomCard') }
async function tap(parent, selector) { const e=await parent.$(selector); assert.ok(e, selector); await e.tap() }
async function api(url, method='GET', body) {
  const r=await fetch('http://127.0.0.1:8029/api'+url, { method, headers:{ Authorization:'Bearer '+token, 'Content-Type':'application/json' }, body:body ? JSON.stringify(body) : undefined })
  assert.ok(r.ok, url+': '+r.status); return r.json()
}
async function list(url) { const result=await api(url); return Array.isArray(result)?result:result.items }
async function seed(theme, empty=false) {
  const r=await fetch(`http://127.0.0.1:8029/qa/seed?theme=${theme}&empty=${empty}`, {method:'POST'})
  assert.ok(r.ok); const data=await r.json(); token=data.token
  await fresh()
  await mp.callWxMethod('setStorageSync','agency.session',token)
  await mp.callWxMethod('setStorageSync','agency.theme.auto.v1:'+data.user_id,false)
  await mp.callWxMethod('setStorageSync','agency.onboarding.paused.v1.'+data.user_id,true)
  await reload(); return data
}
async function reload() {
  await mp.callWxMethod('reLaunch',{url:'/pages/index/index'})
  await until(async()=>!!await home(),'Home loads'); await mp.pageScrollTo(0)
}
async function bounds(element) { return {...await element.offset(), ...await element.size()} }
async function capture(name) {
  await fresh(); const c=await card(), device=await mp.systemInfo()
  const selectors=['.bloom-home-card','.bloom-card-copy','.bloom-card-title','.bloom-card-footer','.bloom-details','.bloom-invitation','.bloom-character-button']
  const measurements={}
  for (const selector of selectors) { const e=await c.$(selector); if(e) measurements[selector]=await bounds(e) }
  const character=measurements['.bloom-character-button'], title=measurements['.bloom-card-title']
  assert.ok(character.left+character.width <= device.windowWidth+.5,'Bloom stays inside the viewport')
  const overlaps=(a,b)=>a.left<b.left+b.width && a.left+a.width>b.left && a.top<b.top+b.height && a.top+a.height>b.top
  assert.ok(!overlaps(title,character),'Bloom does not obscure the title')
  const invitation=measurements['.bloom-invitation']
  if(invitation) {
    assert.ok(invitation.left>=0 && invitation.left+invitation.width<=device.windowWidth,'Invitation stays inside the viewport')
    assert.ok(invitation.height<=34,'Invitation is a compact single line')
  }
  assert.ok(character.width>=44 && character.height>=44,'Bloom has a full touch target')
  assert.equal(await c.$('[data-home="continue"]'),null,'Bloom is the only conversation entry')
  assert.equal(await c.$('.bloom-dismiss'),null,'There is no invitation close button')
  assert.equal(await (await c.$('.bloom-home-card')).style('border-top-left-radius'),'8px')
  await mp.screenshot({path:path.join(out,name+'.png')})
  return {name,device:{model:device.model,width:device.windowWidth,height:device.windowHeight},measurements}
}
;(async()=>{
  await fs.mkdir(out,{recursive:true})
  const cfgPath=path.join(project,'project.config.json'), config=JSON.parse(await fs.readFile(cfgPath,'utf8'))
  if(process.argv.includes('--prepare')) {
    assert.match(await fs.readFile(path.join(project,'pages/index/useIndexPage.js'),'utf8'),/127\.0\.0\.1:8029/)
    config.appid='touristappid'; config.projectname='Agency Bloom Home Card QA'
    config.setting.urlCheck=false; config.setting.compileHotReLoad=false
    await fs.writeFile(cfgPath,JSON.stringify(config,null,2)); return
  }
  assert.equal(config.appid,'touristappid')
  assert.equal((await (await fetch('http://127.0.0.1:8029/qa/status')).json()).paid_requests,0)
  const reports=[]
  for (const theme of ['forest','light','dark']) {
    const seeded=await seed(theme)
    reports.push(await capture('home-'+theme))
    const before=await list('/conversations')
    await tap(await card(),'[data-home="bloom"]')
    await until(async()=>!!await page.$('pages\\/index\\/ChatView'),'Bloom opens chat')
    assert.equal(await mp.callWxMethod('getStorageSync','agency.selected-conversation.v1:'+seeded.user_id),seeded.conversation_id)
    assert.equal((await list('/conversations')).length,before.length,'Opening does not create a conversation')
    await reload()
    await tap(await card(),'[data-home="bloom"]')
    await until(async()=>!!await page.$('pages\\/index\\/ChatView'),'Bloom reopens the same chat')
    assert.equal(await mp.callWxMethod('getStorageSync','agency.selected-conversation.v1:'+seeded.user_id),seeded.conversation_id)
  }
  await seed('forest',true)
  reports.push(await capture('home-empty'))
  assert.equal((await (await (await card()).$('.bloom-invitation')).text()).replace(/\s/g,''),'你想先聊聊什么？')
  await tap(await card(),'[data-home="bloom"]')
  await until(async()=>!!await page.$('pages\\/index\\/ChatView'),'Empty entry opens a local draft')
  assert.equal((await list('/conversations')).length,0,'Draft entry does not persist a conversation')
  assert.equal((await list('/issues')).length,0,'Draft entry does not persist an exploration')
  assert.deepEqual(errors,[])
  await fs.writeFile(path.join(out,'native-report.json'),JSON.stringify({reports,exceptions:errors,consoleErrors,paidRequests:0},null,2))
  console.log(JSON.stringify({screens:reports.map(r=>({name:r.name,...r.device})),exceptions:errors,consoleErrors,paidRequests:0}))
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{if(mp)await mp.disconnect()})

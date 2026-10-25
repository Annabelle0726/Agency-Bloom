// Isolated tourist project: build with API 8023 into output/discover-design/native-project.
// Run mock-discovery-api.py, set touristappid, then CLI auto on port 9460.
const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict')
const auto = require('../output/native-sdk/node_modules/miniprogram-automator')
const out = path.resolve(__dirname, '../output/discover-design')
let mp, page
const wait = ms => new Promise(r => setTimeout(r, ms))
async function fresh() {
  if (mp) await mp.disconnect()
  mp = await auto.connect({ wsEndpoint: 'ws://127.0.0.1:9460' })
  page = (await mp.pageStack())[0]
}
async function until(check, label) {
  for (let i = 0; i < 30; i++) { await fresh(); if (page && await check()) return; await wait(200) }
  throw Error(label)
}
const component = name => page.$(name.replaceAll('/', '\\/'))
const discover = () => component('pages/index/views/DiscoverView')
;(async () => {
  const config = JSON.parse(await fs.readFile(path.join(out,'native-project/project.config.json'),'utf8'))
  assert.equal(config.appid,'touristappid')
  assert.equal((await (await fetch('http://127.0.0.1:8023/qa/status')).json()).provider,'discovery-isolated')
  const seed = await (await fetch('http://127.0.0.1:8023/qa/seed?theme=dark',{method:'POST'})).json()
  await fresh()
  await mp.callWxMethod('setStorageSync','agency.session',seed.token)
  await mp.callWxMethod('setStorageSync','agency.theme.auto.v1:'+seed.user_id,false)
  await mp.callWxMethod('setStorageSync','agency.onboarding.paused.v1.'+seed.user_id,true)
  await mp.callWxMethod('reLaunch',{url:'/pages/index/index'})
  await until(async()=>!!await component('pages/index/views/AppTabbar'),'Workspace ready')
  const bar = await component('pages/index/views/AppTabbar')
  await (await bar.$('[data-tab="discover"]')).tap()
  await until(async()=>!!await discover() && (await (await discover()).$$('.discover-angle')).length>0,'Angles ready')
  const view = await discover(), info = await mp.systemInfo()
  assert.ok(await component('pages/index/views/BloomMoment'),'Inspiration remains visible with its own body fold')
  const cards = await view.$$('.discover-angle')
  for(const card of cards) { const p=await card.offset(), s=await card.size(); assert.ok(p.left>=0 && p.left+s.width<=info.windowWidth+1,'No horizontal clipping') }
  await mp.screenshot({path:path.join(out,'native-dark.png')})
  const first = await view.$('.discover-source'); await first.tap()
  assert.ok(await view.$('.discover-source-detail'),'Source can be inspected')
  const before = await (await fetch('http://127.0.0.1:8023/api/conversations',{headers:{Authorization:'Bearer '+seed.token}})).json()
  await (await view.$('.discover-explore')).tap()
  await until(async()=>!!await component('pages/index/chat/ChatComposer'),'Editable draft opened')
  const composer = await component('pages/index/chat/ChatComposer')
  assert.match(await (await composer.$('.chat-input')).value(),/我留下的线索/)
  const after = await (await fetch('http://127.0.0.1:8023/api/conversations',{headers:{Authorization:'Bearer '+seed.token}})).json()
  assert.equal(after.length,before.length,'Opening a card creates no conversation')
  await mp.screenshot({path:path.join(out,'native-handoff.png')})
  await fs.writeFile(path.join(out,'native-result.json'),JSON.stringify({width:info.windowWidth,height:info.windowHeight,cards:cards.length,paidRequests:0,checks:['source preview','folded inspiration','editable handoff','no auto send or conversation creation','card bounds']},null,2))
  await mp.disconnect(); console.log('Native Discover checks passed')
})().catch(async e=>{console.error(e);if(mp)await mp.disconnect();process.exitCode=1})

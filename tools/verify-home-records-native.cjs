// Only the copied tourist project, automation 9463 and disposable Mock API 8031.
// Build VITE_API_BASE_URL=http://127.0.0.1:8031/api into output/home-records/native-project.
// Run --prepare, open it with Developer Tools CLI auto --auto-port 9463, then run this helper.
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict')
const auto=require('../output/native-sdk/node_modules/miniprogram-automator')
const WS=require('../output/native-sdk/node_modules/ws')
const out=path.resolve(__dirname,'../output/home-records'),project=path.join(out,'native-project')
const wait=ms=>new Promise(r=>setTimeout(r,ms))
let mp,page
async function runtimeInfo(){
  return new Promise((resolve,reject)=>{
    const socket=new WS('ws://127.0.0.1:9463'),timer=setTimeout(()=>{socket.terminate();reject(Error('Native automation endpoint did not become ready'))},8000)
    socket.on('open',()=>socket.send(JSON.stringify({id:1,method:'Tool.getInfo',params:{}})))
    socket.on('error',error=>{clearTimeout(timer);reject(error)})
    socket.on('message',data=>{const result=JSON.parse(data.toString());if(result.id!==1)return;clearTimeout(timer);socket.close();resolve(result.result||{})})
  })
}
async function fresh(){if(mp)await mp.disconnect();mp=await auto.connect({wsEndpoint:'ws://127.0.0.1:9463'});page=(await mp.pageStack())[0]}
const component=name=>page.$(name.replaceAll('/','\\/'))
async function records(){const home=await component('pages/index/views/HomeView');return home&&home.$('components\\/HomeRecordsCard')}
async function until(check,label){for(let i=0;i<35;i++){await fresh();if(page&&await check())return;await wait(200)}throw Error(label)}
;(async()=>{
  await fs.mkdir(out,{recursive:true})
  const configFile=path.join(project,'project.config.json'),config=JSON.parse(await fs.readFile(configFile,'utf8'))
  if(process.argv.includes('--prepare')){
    assert.match(await fs.readFile(path.join(project,'pages/index/useIndexPage.js'),'utf8'),/127\.0\.0\.1:8031/)
    config.appid='touristappid';config.projectname='Home Records Isolated QA';config.libVersion='3.17.4';config.setting.urlCheck=false;config.setting.compileHotReLoad=false
    await fs.writeFile(configFile,JSON.stringify(config,null,2));return
  }
  assert.equal(config.appid,'touristappid')
  const info=await runtimeInfo()
  if(!info.SDKVersion)throw Error('Developer Tools returned IDE metadata without a Mini Program SDKVersion; native runtime unavailable')
  const status=await(await fetch('http://127.0.0.1:8031/qa/status')).json();assert.equal(status.provider,'discovery-isolated');assert.equal(status.paid_requests,0)
  const seed=await(await fetch('http://127.0.0.1:8031/qa/seed?theme=dark',{method:'POST'})).json()
  await fresh()
  await mp.callWxMethod('setStorageSync','agency.session',seed.token)
  await mp.callWxMethod('setStorageSync','agency.theme.auto.v1:'+seed.user_id,false)
  await mp.callWxMethod('setStorageSync','agency.onboarding.paused.v1.'+seed.user_id,true)
  await mp.callWxMethod('reLaunch',{url:'/pages/index/index'})
  await until(async()=>!!await records(),'Home record component loads')
  const view=await records(),device=await mp.systemInfo(),rows=await view.$$('.home-record-row')
  assert.equal(rows.length,2,'Only the latest feedback and the chosen step are shown')
  const observation=await view.$('[data-destination="expand"]');await observation.tap()
  await until(async()=>!!await(await records()).$('.home-record-fold'),'Full saved feedback can be read')
  const row=await(await records()).$('.home-record-row'),position=await row.offset();await mp.pageScrollTo(Math.max(0,position.top-150))
  await mp.screenshot({path:path.join(out,'native-records.png')})
  const size=await(await(await records()).$('.home-records')).size();assert.ok(size.width<=device.windowWidth,'Record card fits the native viewport')
  await(await(await records()).$('[data-destination="plan"]')).tap()
  await until(async()=>!!await component('pages/index/views/PlanView'),'Chosen attempt opens the existing Plan page')
  await fs.writeFile(path.join(out,'native-result.json'),JSON.stringify({model:device.model,width:device.windowWidth,height:device.windowHeight,rows:2,checks:['current-exploration records','full feedback expansion','existing Plan destination'],paidRequests:0},null,2))
  console.log('Native Home records checks passed')
})().catch(async error=>{
  await fs.mkdir(out,{recursive:true});await fs.writeFile(path.join(out,'native-limitation.json'),JSON.stringify({verified:false,error:String(error)},null,2))
  console.error(error);process.exitCode=1
}).finally(async()=>{if(mp)await mp.disconnect()})

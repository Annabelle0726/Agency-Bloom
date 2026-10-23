// Only the copied tourist project, Mock API 8018 and automation 9438.
// Build/prepare as documented in verify-conversations-native.cjs. No paid API.
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const auto=require('../output/native-sdk/node_modules/miniprogram-automator');
const Connection=require('../output/native-sdk/node_modules/miniprogram-automator/out/Connection').default;
const root=path.resolve(__dirname,'..'),out=path.join(root,'output/read-aloud');
const project=path.join(root,'output/conversations/native-project');
let mp,page,auth,preflight=false;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function api(route,method='GET',body){
  const r=await fetch('http://127.0.0.1:8018'+route,{method,headers:{'Content-Type':'application/json',...(auth?{Authorization:auth}:{})},body:body?JSON.stringify(body):undefined});
  assert.ok(r.ok,`${route}: ${r.status}`);return r.status===204?null:r.json();
}
async function fresh(){
  if(!preflight){
    const connection=await Connection.create('ws://127.0.0.1:9438');
    try{const info=await connection.send('Tool.getInfo');assert.ok(info.SDKVersion,'Isolated simulator did not start: Tool.getInfo has no SDKVersion; playback was not tested')}
    finally{await connection.dispose()}
    preflight=true;
  }
  if(mp)await mp.disconnect();mp=await auto.connect({wsEndpoint:'ws://127.0.0.1:9438'});page=(await mp.pageStack())[0]
}
async function find(selector,scope=page){const el=await scope.$(selector);if(el)return el;for(const child of await scope.$$('component')){const found=await find(selector,child);if(found)return found}return null}
async function until(check,label,ms=18000){const end=Date.now()+ms;do{await fresh();if(page&&await check())return;await sleep(150)}while(Date.now()<end);throw Error(label)}
async function tap(selector){const el=await find(selector);assert.ok(el,selector);await el.tap()}
async function shot(name){await mp.screenshot({path:path.join(out,name+'.png')})}
async function label(){return (await(await find('.speech-toggle')).text()).trim()}
(async()=>{
  assert.equal(JSON.parse(await fs.readFile(path.join(project,'project.config.json'),'utf8')).appid,'touristappid');
  assert.match(await fs.readFile(path.join(project,'pages/index/useIndexPage.js'),'utf8'),/127\.0\.0\.1:8018/);
  assert.equal((await api('/qa/status')).provider,'conversation-isolated-mock');await fs.mkdir(out,{recursive:true});
  const login=await api('/api/auth/dev','POST',{privacy_accepted:true});auth='Bearer '+login.token;
  const me=await api('/api/me','PUT',{ai_consent:true,save_chat:true,theme:'dark'});
  const issue=await api('/api/issues','POST',{title:'按需朗读验收',concerns:['choices']});
  const c=await api('/api/conversations','POST',{issue_id:issue.id,title:'按需朗读验收'});
  await api(`/api/conversations/${c.id}/chat`,'POST',{request_id:require('node:crypto').randomUUID(),message:'朗读验收'});
  await fresh();await mp.callWxMethod('setStorageSync','agency.session',login.token);
  await mp.callWxMethod('setStorageSync',`agency.theme.manual.v1:${me.id}`,true);
  await mp.callWxMethod('setStorageSync',`agency.selected-conversation.v1:${me.id}`,c.id);
  try{await mp.callWxMethod('reLaunch',{url:'/pages/index/index'})}catch{}
  await until(async()=>!!await find('[data-tab="chat"]')||!!await find('.chat-input'),'workspace');
  if(await find('[data-tab="chat"]'))await tap('[data-tab="chat"]');
  await until(async()=>!!await find('.speech-toggle'),'speaker action');
  assert.equal(await label(),'朗读');await shot('idle');
  await tap('.speech-toggle');await until(async()=>!!await find('.speech-notice-accept'),'inline first-use notice');
  assert.ok(await find('.chat-input'),'first-use notice keeps the input mounted');
  assert.equal(!!await find('.modal-backdrop'),false,'first-use notice does not open a modal');
  assert.equal((await api('/api/speech/config')).consented,false);await shot('consent');
  await tap('.speech-notice-accept');await until(async()=>await label()==='暂停','native onPlay');
  await tap('.speech-toggle');await until(async()=>await label()==='继续','native onPause');
  await tap('.speech-rate');assert.equal((await(await find('.speech-rate')).text()).trim(),'1.25×');await shot('paused');
  await tap('.speech-toggle');await until(async()=>await label()==='暂停','native resume');
  await tap('.speech-stop');await until(async()=>await label()==='朗读','stop resets controls');
  await (await find('.chat-input')).input('朗读失败时仍保留的草稿');
  await api('/qa/fail-next-speech-download','POST');await tap('.speech-toggle');
  await until(async()=>!!await find('.composer-error'),'download error above composer');
  assert.equal(await(await find('.chat-input')).value(),'朗读失败时仍保留的草稿');await shot('network-error');
  await tap('.speech-toggle');await until(async()=>await label()==='暂停','manual retry plays cached MP3');
  assert.equal(!!await find('.composer-error'),false);await shot('playing');
  await tap('.chat-header-right .chat-header-button');await until(async()=>!!await find('[data-tab="chat"]'),'leave chat');
  await tap('[data-tab="chat"]');await until(async()=>!!await find('.speech-toggle'),'return chat');
  assert.equal(await label(),'朗读','leaving chat must stop playback');
  // A second real conversation through the existing navigator.
  const other=await api('/api/conversations','POST',{issue_id:issue.id,title:'另一个窗口'});
  await tap('.speech-toggle');await until(async()=>await label()==='暂停','play before switch');
  await tap('.chat-header > .chat-header-button');await until(async()=>!!await find('.workspace-drawer'),'navigator');
  const buttons=await(await find('.workspace-drawer')).$$('button');let selected=false;
  for(const b of buttons){if((await b.text()).includes(other.title)){await b.tap();selected=true;break}}
  assert.ok(selected,'second conversation in navigator');
  await until(async()=>!!await find('.chat-header-name')&&(await(await find('.chat-header-name')).text()).includes(other.title),'conversation switched');
  assert.equal(!!await find('.speech-stop'),false);
  const info=await mp.systemInfo();
  const result={nativeMp3Play:true,pauseResume:true,localSpeed:true,explicitConsent:true,stop:true,leaveStops:true,conversationSwitchStops:true,downloadFailureAboveComposer:true,draftPreserved:true,retryClearsError:true,mode:'mock',paidRequests:0,viewport:{width:info.windowWidth,height:info.windowHeight},realDevice:false};
  await fs.writeFile(path.join(out,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
})().catch(async e=>{await fs.mkdir(out,{recursive:true});await fs.writeFile(path.join(out,'native-blocked.json'),JSON.stringify({passed:false,reason:e.message,paidRequests:0,realDevice:false},null,2));console.error(e.message);process.exitCode=1}).finally(async()=>{if(mp)await mp.disconnect()});

// Isolated tourist project only. Build VITE_API_BASE_URL=http://127.0.0.1:8023/api,
// run --prepare, CLI auto project output/discovery/native-project port 9443,
// run mock-discovery-api.py, then this script. Never attach the personal project.
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const auto=require('../output/native-sdk/node_modules/miniprogram-automator');
const root=path.resolve(__dirname,'..'),out=path.join(root,'output/discovery'),project=path.join(out,'native-project');
const wait=ms=>new Promise(r=>setTimeout(r,ms)); let mp,page,auth; const errors=[];
async function api(route,method='GET',body){const r=await fetch('http://127.0.0.1:8023'+route,{method,headers:{'Content-Type':'application/json',...(auth?{Authorization:auth}:{})},body:body?JSON.stringify(body):undefined}); assert.ok(r.ok,route+': '+r.status);return r.status===204?null:r.json()}
async function refresh(){if(mp)await mp.disconnect();mp=await auto.connect({wsEndpoint:'ws://127.0.0.1:9443'});mp.on('exception',e=>errors.push(String(e)));page=await mp.currentPage()}
async function until(check,label){for(let i=0;i<80;i++){await refresh();if(page&&await check())return;await wait(180)}throw Error(label)}
const component=name=>page.$(name.replaceAll('/','\\/'));
const bar=()=>component('pages/index/views/AppTabbar'), discover=()=>component('pages/index/views/DiscoverView'), composer=()=>component('pages/index/chat/ChatComposer'), chat=()=>component('pages/index/ChatView');
async function tab(name){
  if(!await bar()){ const header=await (await chat()).$('pages\\/index\\/chat\\/ChatHeader'); await tap(header,'[aria-label="返回主界面"]'); await until(async()=>!!await bar(),'Return from chat'); }
  await tap(await bar(),'[data-tab="'+name+'"]');
}
async function tap(parent,selector){const e=await parent.$(selector);assert.ok(e,selector);await e.tap()}
async function questions(){return Promise.all((await (await discover()).$$('.discovery-question')).map(e=>e.text()))}
async function openDiscover(){await tab('discover');await until(async()=>!!await discover()&&(await questions()).length>0,'Discovery loads')}
async function shot(name){await mp.screenshot({path:path.join(out,name+'.png')})}
async function enter(seed){auth='Bearer '+seed.token;await refresh();await mp.callWxMethod('setStorageSync','agency.session',seed.token);await mp.callWxMethod('setStorageSync','agency.theme.manual.v1:'+seed.user_id,true);await mp.callWxMethod('setStorageSync','agency.onboarding.paused.v1.'+seed.user_id,true);await mp.callWxMethod('reLaunch',{url:'/pages/index/index'});await until(async()=>!!await bar(),'Workspace loaded')}
async function oldConversation(id){
  const header=await (await chat()).$('pages\\/index\\/chat\\/ChatHeader');
  await tap(header,'[aria-label="打开会话列表"]');
  await until(async()=>!!await component('components/ConversationDrawer'),'Drawer opens');
  const drawer=await component('components/ConversationDrawer');
  const buttons=await drawer.$$('.conversation-select');
  for(const button of buttons) if((await button.text()).includes('职业选择 · 原会话')){await button.tap();await until(async()=>!!await composer()&&!await component('components/ConversationDrawer'),'Old chat selected');return}
  throw Error('Old conversation unavailable '+id)
}
(async()=>{
 await fs.mkdir(out,{recursive:true});
 if(process.argv.includes('--prepare')){const source=path.join(root,'apps/miniprogram/dist/build/mp-weixin');assert.match(await fs.readFile(path.join(source,'pages/index/useIndexPage.js'),'utf8'),/127\.0\.0\.1:8023/);await fs.cp(source,project,{recursive:true});const config=JSON.parse(await fs.readFile(path.join(project,'project.config.json'),'utf8'));config.appid='touristappid';config.projectname='Agency Bloom Discovery QA';config.setting.urlCheck=false;await fs.writeFile(path.join(project,'project.config.json'),JSON.stringify(config,null,2));return}
 assert.equal(JSON.parse(await fs.readFile(path.join(project,'project.config.json'),'utf8')).appid,'touristappid');assert.equal((await api('/qa/status')).provider,'discovery-isolated');
 const seed=await api('/qa/seed?theme=forest','POST');auth='Bearer '+seed.token;
 await api('/api/conversations/'+seed.conversation_id,'PUT',{version:1,title:'职业选择 · 原会话'});
 // The exact reported scenario: A has saved history plus an unsent draft.
 await api('/api/conversations/'+seed.conversation_id+'/chat','POST',{request_id:crypto.randomUUID(),message:'职业方向的旧话题',history:[]});
 await enter(seed);await tab('chat');await until(async()=>!!await composer(),'A composer');
 const original='我在旧聊天里还没说完的话';await (await (await composer()).$('.chat-input')).input(original);
 const oldMessages=(await api('/api/conversations/'+seed.conversation_id+'/messages')).items;
 await openDiscover();const first=await questions();assert.ok(first.some(q=>q.includes('需求分析')||q.includes('真实尝试')||q.includes('时间安排')));await shot('forest-discover');
 await tab('now');await openDiscover();assert.deepEqual(await questions(),first);
 const card=await (await discover()).$('.discovery-card');await Promise.all([card.tap(),card.tap()]);
 await until(async()=>!!await composer(),'Fresh draft opens');
 assert.equal((await api('/api/conversations')).length,1,'Click must not create a conversation');
 assert.equal((await (await chat()).$$('pages\\/index\\/chat\\/ChatMessage')).length,0,'New draft history is empty');
 assert.equal(await (await (await composer()).$('.chat-input')).value(),first[0]);
 await (await (await composer()).$('.chat-input')).input('');assert.equal(await (await (await composer()).$('.chat-input')).value(),'');
 await (await (await composer()).$('.chat-input')).input('由我改写的新问题');await shot('fresh-draft');
 await oldConversation(seed.conversation_id);
 assert.equal(await (await (await composer()).$('.chat-input')).value(),original,'Old draft survives');
 assert.deepEqual((await api('/api/conversations/'+seed.conversation_id+'/messages')).items,oldMessages);
 await shot('old-draft-restored');
 await openDiscover();await tap(await discover(),'.discovery-card');await until(async()=>!!await composer(),'Second draft');
 await (await (await composer()).$('.chat-input')).input('我愿意继续了解这个问题');
 await api('/qa/fail-next','POST');await tap(await composer(),'.send-button');
 await until(async()=>!!await (await chat()).$('.chat-error'),'Failed creation is visible');
 assert.equal((await api('/api/conversations')).length,1);assert.equal(await (await (await composer()).$('.chat-input')).value(),'我愿意继续了解这个问题');
 const send=await (await composer()).$('.send-button');await Promise.all([send.tap(),send.tap()]);
 await until(async()=> { const all=await api('/api/conversations'); const created=all.find(c=>c.id!==seed.conversation_id); return all.length===2 && created && (await api('/api/conversations/'+created.id+'/messages')).items.length===2; },'One real conversation and completed first send');
 const created=(await api('/api/conversations')).find(c=>c.id!==seed.conversation_id);assert.equal(created.issue_id,seed.issue_id);assert.equal((await api('/api/issues')).length,1);
 assert.equal((await api('/api/conversations/'+created.id+'/messages')).items.length,2,'Only one normal chat turn');
 await oldConversation(seed.conversation_id);assert.equal(await (await (await composer()).$('.chat-input')).value(),original);
 await openDiscover();const beforeRotation=await questions();await tap(await discover(),'.discovery-rotate');await refresh();const afterRotation=await questions();assert.notDeepEqual(afterRotation,beforeRotation);
 const rejected=afterRotation[0];await tap(await discover(),'.discovery-dismiss');await refresh();assert.ok(!(await questions()).includes(rejected));
 await mp.callWxMethod('reLaunch',{url:'/pages/index/index'});await until(async()=>!!await bar(),'Reload');await openDiscover();assert.ok(!(await questions()).includes(rejected),'Dismissal persists for this account');
 for(const theme of process.argv.includes('--flows-only')?[]:['dark','light','dawn','lavender','minimal']){const themed=await api('/qa/seed?theme='+theme,'POST');await enter(themed);await openDiscover();await shot(theme+'-discover');assert.ok((await (await page.$('.preview-stage')).attribute('class')).includes('theme-'+theme))}
 const empty=await api('/qa/seed?theme=forest&empty=true','POST');await enter(empty);await openDiscover();assert.ok((await questions()).every(q=>!q.includes('需求分析')));await tap(await discover(),'.discovery-card');await until(async()=>!!await composer(),'Empty account draft');assert.equal((await api('/api/issues')).length,0);await shot('first-exploration-draft');
 // Empty account has no consent: explicitly allow only the fixture before send.
 await api('/api/me','PUT',{ai_consent:true});await mp.callWxMethod('reLaunch',{url:'/pages/index/index'});await until(async()=>!!await bar(),'Empty account reload');await openDiscover();await tap(await discover(),'.discovery-card');await until(async()=>!!await composer(),'Empty draft reopens');await tap(await composer(),'.send-button');await until(async()=> (await api('/api/issues')).length===1 && (await api('/api/conversations')).length===1 && !!await (await composer()).$('.chat-input'),'First issue and conversation saved once');
 assert.deepEqual(errors,[]);const info=await mp.systemInfo();const report={passed:true,width:info.windowWidth,height:info.windowHeight,flows:['old draft and history preserved','clean editable unsaved draft','double click','failed creation retains text','one first-send creation','same exploration','stable visits','manual rotation','dismissal survives reload','account isolation','first-use promotion'],errors,paidRequests:0};await fs.writeFile(path.join(out,'report-'+Date.now()+'.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{if(mp)await mp.disconnect()});

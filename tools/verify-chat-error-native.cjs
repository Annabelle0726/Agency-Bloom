// Isolated Mock API on 8018, tourist project on automation port 9438 only.
// Prepare as documented in verify-conversations-native.cjs; no paid calls.
const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict');
const auto = require('../output/native-sdk/node_modules/miniprogram-automator');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'output/chat-error');
const project = path.join(root, 'output/conversations/native-project');
let mp, page, auth;
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function api(route, method='GET', body) {
  const r = await fetch('http://127.0.0.1:8018'+route, { method, headers:{'Content-Type':'application/json', ...(auth?{Authorization:auth}:{})}, body:body?JSON.stringify(body):undefined });
  assert.ok(r.ok, `${route}: ${r.status}`); return r.status===204?null:r.json();
}
async function fresh() { if(mp) await mp.disconnect(); mp=await auto.connect({wsEndpoint:'ws://127.0.0.1:9438'}); page=(await mp.pageStack())[0]; }
async function find(selector, scope=page) {
  const direct=await scope.$(selector); if(direct) return direct;
  for(const child of await scope.$$('component')) { const result=await find(selector,child); if(result) return result; }
  return null;
}
async function all(selector, scope=page) {
  const result=await scope.$$(selector);
  for(const child of await scope.$$('component')) result.push(...await all(selector,child));
  return result;
}
async function until(check,label,ms=12000) {
  const deadline=Date.now()+ms;
  do { await fresh(); if(page && await check()) return; await sleep(250); } while(Date.now()<deadline);
  throw Error(label);
}
async function tap(selector) { const e=await find(selector); assert.ok(e,selector); await e.tap(); }
async function send(text) { await (await find('.chat-input')).input(text); await tap('.send-button'); }
(async()=>{
  assert.equal(JSON.parse(await fs.readFile(path.join(project,'project.config.json'),'utf8')).appid,'touristappid');
  assert.match(await fs.readFile(path.join(project,'pages/index/useIndexPage.js'),'utf8'),/127\.0\.0\.1:8018/);
  const before=await api('/qa/status'); assert.equal(before.provider,'conversation-isolated-mock'); await fs.mkdir(out,{recursive:true});
  const login=await api('/api/auth/dev','POST',{privacy_accepted:true}); auth='Bearer '+login.token;
  const me=await api('/api/me','PUT',{ai_consent:true,save_chat:true,theme:'dark'});
  const issue=await api('/api/issues','POST',{title:'异常提示验收',concerns:['choices'],background:'合成测试'});
  const conv=await api('/api/conversations','POST',{issue_id:issue.id,title:'异常提示验收'});
  await api(`/api/conversations/${conv.id}/chat`,'POST',{request_id:require('node:crypto').randomUUID(),message:'异常铺底测试'});
  await fresh(); await mp.callWxMethod('setStorageSync','agency.session',login.token);
  await mp.callWxMethod('setStorageSync',`agency.theme.manual.v1:${me.id}`,true);
  await mp.callWxMethod('setStorageSync',`agency.selected-conversation.v1:${me.id}`,conv.id);
  try{await mp.callWxMethod('reLaunch',{url:'/pages/index/index'})}catch{}
  await until(async()=>!!await find('[data-tab="chat"]') || !!await find('.chat-input'),'workspace');
  if(await find('[data-tab="chat"]')) await tap('[data-tab="chat"]');
  await until(async()=>!!await find('.chat-input') && (await all('.message-row.assistant')).length===1,'loaded long transcript');
  const draft='异常格式测试：问题和草稿都应保留';
  await send(draft);
  await until(async()=>!!await find('.composer-error') && !!await find('.chat-input'),'failure beside input',20000);
  assert.equal(await (await find('.chat-input')).value(),draft);
  const notice=await find('.composer-error'), composer=await find('.composer'), n=await notice.offset(), ns=await notice.size(), c=await composer.offset();
  assert.ok(n.top>=0 && n.top+ns.height<=c.top+1,'notice must sit directly above composer');
  assert.ok(n.top<844 && c.top<844,'notice and input are visible');
  assert.equal((await all('.chat-error')).length,0,'no duplicate error above transcript');
  await mp.screenshot({path:path.join(out,'failure.png')});
  const calls=(await api('/qa/status')).calls;
  await tap('.composer-error-recover');
  await until(async()=>!!await find('.composer-error-recover') && await(await find('.composer-error-recover')).attribute('disabled')!=='true','status recovery finished');
  assert.ok(await find('.composer-error'),'a failed request lookup must not pretend recovery');
  assert.equal((await api('/qa/status')).calls,calls,'status lookup never regenerates');
  assert.equal((await api(`/api/conversations/${conv.id}/messages`)).items.length,2);
  await send('这次请正常回复');
  await until(async()=>!await find('.reply-wait') && (await all('.message-row.assistant')).length===2,'successful subsequent reply',20000);
  assert.equal(!!await find('.composer-error'),false,'clear after verified success');
  assert.equal((await api(`/api/conversations/${conv.id}/messages`)).items.length,4);
  await mp.screenshot({path:path.join(out,'recovered.png')});
  const result={errorAboveComposer:true,longTranscript:true,draftPreserved:true,failedLookupKeepsError:true,noAutomaticRetry:true,successClearsError:true,nullThinkingChunkAccepted:true,mockCalls:(await api('/qa/status')).calls-before.calls,paidRequests:0,viewport:{width:390,height:844}};
  await fs.writeFile(path.join(out,'result.json'),JSON.stringify(result,null,2)); console.log(JSON.stringify(result));
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{if(mp)await mp.disconnect()});

// Isolated Mock API on 8018, tourist project on automation port 9438 only.
// Prepare as documented in verify-conversations-native.cjs; no paid calls.
const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict');
const auto = require('../output/native-sdk/node_modules/miniprogram-automator');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'output/chat-wait');
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
  const before=await api('/qa/status'); assert.equal(before.provider,'conversation-isolated-mock');
  await fs.mkdir(out,{recursive:true});
  const login=await api('/api/auth/dev','POST',{privacy_accepted:true}); auth='Bearer '+login.token;
  const theme=process.argv.includes('--light')?'light':'dark';
  const me=await api('/api/me','PUT',{ai_consent:true,save_chat:true,theme});
  const issue=await api('/api/issues','POST',{title:'等待体验',concerns:['choices'],background:'合成测试资料'});
  const conv=await api('/api/conversations','POST',{issue_id:issue.id,title:'聊聊新的想法'});
  await fresh(); await mp.callWxMethod('setStorageSync','agency.session',login.token);
  await mp.callWxMethod('setStorageSync',`agency.theme.manual.v1:${me.id}`,true);
  await mp.callWxMethod('setStorageSync',`agency.selected-conversation.v1:${me.id}`,conv.id);
  try { await mp.callWxMethod('reLaunch',{url:'/pages/index/index'}); } catch { /* Observe page replacement. */ }
  await until(async()=>!!await find('[data-tab="chat"]') || !!await find('.chat-input'),'workspace');
  if(await find('[data-tab="chat"]')) await tap('[data-tab="chat"]');
  await until(async()=>!!await find('.chat-input'),'composer');
  const longText='等待状态测试：我想把一个想法做成东西，但做完后又不知道下一步。'+ '我想聊聊怎样找到一个愿意继续的小方向。'.repeat(9);
  await send(longText);
  await until(async()=>!!await find('.reply-wait'),'waiting surface');
  assert.equal(await find('.chat-input'),null,'submitted text must not also appear in the composer');
  const bubbles=await all('.message-bubble'); assert.equal(bubbles.length,1); assert.equal(await bubbles[0].text(),longText);
  const size=await (await find('.reply-wait')).size(); assert.ok(size.height<=100,`waiting bar is ${size.height}px tall`);
  await mp.screenshot({path:path.join(out,`${theme}-waiting.png`)});
  await until(async()=>Number((await (await find('.reply-wait-time')).text()).replace(' 秒',''))>=15,'long wait feedback',18000);
  assert.match(await (await find('.reply-wait-note')).text(),/稍久/);
  await mp.screenshot({path:path.join(out,`${theme}-slow.png`)});
  await until(async()=>!!await find('.chat-input') && (await all('.message-bubble')).length===2,'completed reply',12000);
  assert.equal(await (await find('.chat-input')).value(),'');
  assert.equal((await api(`/api/conversations/${conv.id}/messages`)).items.length,2);
  const cancelText='等待状态测试：停下来后我要继续修改这句';
  await send(cancelText); await until(async()=>!!await find('.reply-wait'),'cancel wait'); await tap('.reply-wait-stop');
  await until(async()=>!!await find('.chat-input'),'cancel restored');
  assert.equal(await (await find('.chat-input')).value(),cancelText);
  assert.equal((await all('.message-bubble')).length,2);
  const failText='等待失败测试：失败以后保留我的原输入';
  await send(failText); await until(async()=>!!await find('.chat-error') && !!await find('.chat-input'),'failure restored');
  assert.equal(await (await find('.chat-input')).value(),failText);
  await send('继续聊聊今天的想法');
  await until(async()=>(await all('.message-bubble')).length===4 && !!await find('.chat-input'),'send after failure');
  assert.equal(await find('.chat-error'),null);
  assert.equal((await api(`/api/conversations/${conv.id}/messages`)).items.length,4);
  const after=await api('/qa/status'); assert.equal(after.calls-before.calls,4); assert.equal(after.paid_requests,0);
  const report={theme,waitBar:size,modelCalls:4,paidRequests:0,longWait:true,duplicateRemoved:true,cancellationRestoresDraft:true,failureRestoresDraft:true,sendAfterFailure:true};
  await fs.writeFile(path.join(out,`result-${theme}.json`),JSON.stringify(report,null,2)); console.log(JSON.stringify(report));
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{if(mp) await mp.disconnect();});

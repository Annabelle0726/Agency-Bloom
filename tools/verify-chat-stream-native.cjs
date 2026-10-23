// Isolated Mock API on 8018, tourist project on automation port 9438 only.
// Prepare as documented in verify-conversations-native.cjs; no paid calls.
const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict');
const auto = require('../output/native-sdk/node_modules/miniprogram-automator');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'output/chat-stream');
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
  const me=await api('/api/me','PUT',{ai_consent:true,save_chat:true,theme:'dark'});
  const issue=await api('/api/issues','POST',{title:'流式回复体验',concerns:['choices'],background:'合成测试'});
  const conv=await api('/api/conversations','POST',{issue_id:issue.id,title:'流式体验测试'});
  await fresh(); await mp.callWxMethod('setStorageSync','agency.session',login.token);
  await mp.callWxMethod('setStorageSync',`agency.theme.manual.v1:${me.id}`,true);
  await mp.callWxMethod('setStorageSync',`agency.selected-conversation.v1:${me.id}`,conv.id);
  try { await mp.callWxMethod('reLaunch',{url:'/pages/index/index'}); } catch {}
  await until(async()=>!!await find('[data-tab="chat"]') || !!await find('.chat-input'),'workspace');
  if(await find('[data-tab="chat"]')) await tap('[data-tab="chat"]');
  await until(async()=>!!await find('.chat-input'),'composer');
  await send('流式体验测试：这周有点累，想聊聊');
  await until(async()=>!!await find('.stream-text'),'incremental reply',20000);
  const first=await (await find('.stream-text')).text();
  console.log('first preview',first.length);
  assert.equal((await all('.message-row.assistant')).length,0,'not a committed reply yet');
  await mp.screenshot({path:path.join(out,'streaming.png')});
  await api('/qa/stream-step','POST',{});
  await until(async()=>{const e=await find('.stream-text');return e && (await e.text()).length>first.length+60},'reply grows');
  await until(async()=>{const bottom=await(await find('#chat-bottom')).offset();const row=await(await find('.message-row.user')).offset();return bottom.top<844 && row.top<-100},'auto follows overflowing reply');
  await mp.callWxMethod('pageScrollTo',{scrollTop:0,duration:0});
  await until(async()=>!!await find('.jump-latest'),'reader can pause following');
  assert.ok((await(await find('#chat-bottom')).offset()).top>844);
  await mp.screenshot({path:path.join(out,'reading-older.png')});
  await tap('.jump-latest');
  await until(async()=>(await(await find('#chat-bottom')).offset()).top<844,'return to latest');
  await api('/qa/stream-step','POST',{});
  await until(async()=>!await find('.streaming-reply') && (await all('.message-row.assistant')).length===1,'completed reply',20000);
  const saved=(await api(`/api/conversations/${conv.id}/messages`)).items;
  assert.equal(saved.length,2); assert.ok(saved[1].content.includes('🌿'));
  assert.ok(!JSON.stringify(saved).includes('MOCK_PRIVATE_REASONING'));
  assert.ok(await find('.message-copy'));
  await mp.callWxMethod('pageScrollTo',{scrollTop:0,duration:0});
  await until(async()=>(await(await find('.message-row.user')).offset()).top>0,'selection target visible');
  const selectable=await find('.selectable-reply'), bubble=await find('.message-bubble',selectable), at=await bubble.offset();
  await bubble.dispatchEvent({eventName:'longpress',touches:[{clientX:at.left+6,clientY:at.top+6}]});
  await until(async()=>!!await find('.selection-ask'),'selection toolbar');
  assert.ok(await find('.chat-input'),'composer remains visible during selection');
  assert.ok((await(await find('.chat-input')).size()).height>0);
  assert.ok((await(await find('.chat-input')).offset()).top<844);
  const chars=await all('.selection-char'); const target=await chars[18].offset();
  const handle=await find('.selection-handle.end');
  await handle.touchmove({touches:[{clientX:target.left+3,clientY:target.top+6}]});
  await until(async()=>(await all('.selection-char.chosen')).length>3,'drag a selected range');
  const chosen=(await Promise.all((await all('.selection-char.chosen')).map(e=>e.text()))).join('');
  assert.ok(chosen.length<saved[1].content.length);
  const toolbar=await find('.selection-toolbar'), toolbarAt=await toolbar.offset();
  assert.ok(toolbarAt.top>=70 && toolbarAt.top<750,'selection toolbar remains visible');
  await mp.screenshot({path:path.join(out,'ask-selection.png')});
  await tap('.selection-ask');
  await until(async()=>!!await find('.selected-quote'),'Ask Bloom quote chip');
  assert.equal(await (await find('.selected-quote-text')).text(),chosen);
  assert.equal(await (await find('.chat-input')).value(),'');
  assert.equal((await api('/qa/status')).calls-before.calls,1);
  await mp.screenshot({path:path.join(out,'completed.png')});
  await send('流式体验测试：停止测试');
  await until(async()=>!!await find('.stream-text'),'second live reply',20000);
  await tap('.reply-wait-stop');
  await until(async()=>!!await find('.chat-input'),'cancel returns composer');
  assert.equal((await (await find('.chat-input')).value()),'流式体验测试：停止测试');
  assert.equal((await api(`/api/conversations/${conv.id}/messages`)).items.length,2);
  const result={incrementalReply:true,autoFollow:true,pauseWhenReading:true,jumpLatest:true,selectedExcerpt:true,selectedQuestionDraft:true,composerVisibleWhileSelecting:true,cancelPreservesDraft:true,noPartialPersistence:true,privateReasoningHidden:true,mockCalls:2,paidRequests:0,viewport:await mp.callWxMethod('getSystemInfoSync')};
  result.viewport={width:result.viewport.windowWidth,height:result.viewport.windowHeight};
  await fs.writeFile(path.join(out,'result.json'),JSON.stringify(result,null,2)); console.log(JSON.stringify(result));
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{if(mp)await mp.disconnect()});

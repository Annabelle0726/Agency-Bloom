// Isolated Mock API on 8018, tourist project on automation port 9438 only.
// Prepare as documented in verify-conversations-native.cjs; no paid calls.
const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict');
const auto = require('../output/native-sdk/node_modules/miniprogram-automator');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'output/chat-consent');
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
  const me=await api('/api/me','PUT',{ai_consent:false,save_chat:true,theme:'dark'});
  const issue=await api('/api/issues','POST',{title:'确认后继续发送',concerns:['choices'],background:'合成测试'});
  const conv=await api('/api/conversations','POST',{issue_id:issue.id,title:'同意流程测试'});
  await fresh(); await mp.callWxMethod('setStorageSync','agency.session',login.token);
  await mp.callWxMethod('setStorageSync',`agency.theme.manual.v1:${me.id}`,true);
  await mp.callWxMethod('setStorageSync',`agency.selected-conversation.v1:${me.id}`,conv.id);
  try { await mp.callWxMethod('reLaunch',{url:'/pages/index/index'}); } catch {}
  await until(async()=>!!await find('[data-tab="chat"]') || !!await find('.chat-input'),'workspace');
  if(await find('[data-tab="chat"]')) await tap('[data-tab="chat"]');
  await until(async()=>!!await find('.chat-input'),'composer');
  async function checkIcons() {
    const values=[];
    for(const selector of ['.web-toggle','.send-button']) {
      const button=await find(selector), icon=await find('.svg-icon',button);
      const b=await button.size(), bp=await button.offset(), i=await icon.size(), ip=await icon.offset();
      console.log(selector,JSON.stringify({b,bp,i,ip}));
      assert.equal(i.width,19); assert.equal(i.height,19);
      assert.ok(Math.abs(bp.left+b.width/2-ip.left-i.width/2)<1,selector+' horizontal center');
      assert.ok(Math.abs(bp.top+b.height/2-ip.top-i.height/2)<1,selector+' vertical center');
      values.push({button:b,icon:i});
    }
    assert.equal(values[0].button.width,values[1].button.width,'web and send widths match');
    assert.equal(values[0].button.height,values[1].button.height,'web and send heights match');
    return values;
  }
  const icons=await checkIcons();
  const draft='同意后请接着这句话聊。'.repeat(18);
  await send(draft);
  await until(async()=>!!await find('.modal-sheet'),'consent modal');
  assert.equal(!!await find('.chat-input'),false,'native textarea must be unmounted while consent is open');
  assert.equal((await api('/qa/status')).calls,before.calls,'no generation before consent');
  await tap('.ai-consent-dismiss');
  await until(async()=>!!await find('.chat-input') && !await find('.modal-sheet'),'dismiss');
  assert.equal(await (await find('.chat-input')).value(),draft);
  assert.equal((await api('/api/me')).ai_consent,false);
  await checkIcons();
  await tap('.send-button');
  await until(async()=>!!await find('.ai-consent-submit'),'reopen consent');
  await api('/qa/fail-next-consent','POST',{});
  await tap('.ai-consent-submit');
  await until(async()=>!!await find('.error-notice'),'save failure is visible');
  assert.equal((await api('/api/me')).ai_consent,false);
  assert.equal((await api('/qa/status')).calls,before.calls);
  const btn=await find('.ai-consent-submit');
  console.log('button',btn?{disabled:await btn.attribute('disabled'),size:await btn.size(),offset:await btn.offset()}:null);
  await mp.screenshot({path:path.join(out,'save-failure.png')});
  assert.ok(btn,'confirmation button'); if(process.argv.includes('--inspect')) { console.log('inspect modal'); return; } await btn.tap();
  await until(async()=>!await find('.modal-sheet') && (await all('.message-bubble')).length===2,'consent must save and resume send');
  assert.equal((await api('/api/me')).ai_consent,true);
  assert.equal((await api('/qa/status')).calls-before.calls,1);
  assert.equal(await (await find('.chat-input')).value(),'');
  await checkIcons();
  await mp.screenshot({path:path.join(out,'after.png')});
  try { await mp.callWxMethod('reLaunch',{url:'/pages/index/index'}); } catch {}
  await until(async()=>!!await find('[data-tab="chat"]') || !!await find('.chat-input'),'relaunch');
  if(await find('[data-tab="chat"]')) await tap('[data-tab="chat"]');
  await until(async()=>!!await find('.chat-input'),'restored composer');
  await send('继续发送第二条');
  await until(async()=>(await all('.message-bubble')).length===4,'next send after restart');
  assert.equal(!!await find('.modal-sheet'),false);
  const status=await api('/qa/status'); assert.equal(status.calls-before.calls,2); assert.equal(status.paid_requests,0);
  const report={icons,declinePreservesDraft:true,saveFailureVisible:true,explicitRetrySucceeds:true,persistedConsent:true,continuedSend:true,mockCalls:2,paidRequests:0};
  await fs.writeFile(path.join(out,'result.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{if(mp) await mp.disconnect();});

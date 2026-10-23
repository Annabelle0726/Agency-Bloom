// Isolated port 8032 project prepared from the current build. No private account.
// Start mock-visual-cloud-api.py; CLI auto the copied project on port 9454.
// --remote saves a QR and waits for a physical-device connection before testing.
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const Launcher=require('../output/native-sdk/node_modules/miniprogram-automator/out/Launcher').default;
async function connect(){
 const runtime=await new Launcher().connectTool({wsEndpoint:'ws://127.0.0.1:9454'});
 try{await runtime.checkVersion();return runtime;}
 catch(error){await runtime.disconnect();throw Error('WeChat runtime unavailable: SDKVersion was not returned; start the isolated simulator before testing. '+error.message);}
}
const out=path.resolve(__dirname,'../output/visual-cloud-qa'),errors=[];
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let mp,page,auth;
async function api(route,method='GET',body){
 const res=await fetch('http://127.0.0.1:8032'+route,{method,headers:{'Content-Type':'application/json',...(auth?{Authorization:auth}:{})},body:body?JSON.stringify(body):undefined});
 assert.ok(res.ok,route+': '+res.status);return res.status===204?null:res.json();
}
async function fresh(){
 page=(await mp.pageStack())[0];return page;
}
async function until(check,label){
 for(let i=0;i<70;i++){try{await fresh();if(await check())return;}catch{}await wait(250);}
 throw Error(label);
}
async function reload(){
 await mp.callWxMethod('reLaunch',{url:'/pages/index/index'});
 // This IDE version keeps a stale binding immediately after reLaunch.
 await mp.disconnect();mp=await connect();
 mp.on('exception',error=>errors.push(String(error)));
 await until(async()=>!!await page.$('[data-tab="chat"]'),'Workspace unavailable');
 await(await page.$('[data-tab="chat"]')).tap();
 await until(async()=>!!await page.$('.chat-input'),'Chat unavailable');
}
(async()=>{
 await fs.mkdir(out,{recursive:true});
 if(process.argv.includes('--prepare')){
  const root=path.resolve(__dirname,'..'),source=path.join(root,'apps/miniprogram/dist/build/mp-weixin');
  const project=path.join(out,process.argv.includes('--phone-project')?'native-phone-project':'native-cloud-project');
  assert.match(await fs.readFile(path.join(source,'pages/index/useIndexPage.js'),'utf8'),/192\.168\.1\.6:8032/);
  try{await fs.access(project);throw Error('Use a fresh QA destination; existing project is preserved');}catch(error){if(error.code!=='ENOENT')throw error;}
  await fs.cp(source,project,{recursive:true});
  const config=JSON.parse(await fs.readFile(path.join(project,'project.config.json'),'utf8'));
  config.appid=process.argv.includes('--phone-project')?JSON.parse(await fs.readFile(path.join(root,'project.config.json'),'utf8')).appid:'touristappid';
  config.projectname='Bloom Visual Cloud Isolated QA';config.setting.urlCheck=false;
  await fs.writeFile(path.join(project,'project.config.json'),JSON.stringify(config,null,2));console.log(project);return;
 }
 assert.equal((await api('/qa/status')).provider,'isolated-mock');
 mp=await connect();
 mp.on('exception',error=>errors.push(String(error)));
 if(process.argv.includes('--remote')){
  const connected=new Promise(resolve=>mp.connection.once('Tool.onRemoteDebugConnected',resolve));
  const {qrCode}=await mp.send('Tool.enableRemoteDebug',{auto:false});
  if(qrCode)await fs.writeFile(path.join(out,'phone-qr.png'),Buffer.from(qrCode,'base64'));
  console.log('PHONE_QR_READY');
  await Promise.race([connected,new Promise((_,reject)=>setTimeout(()=>reject(Error('Physical-device scan is still required')),300000))]);
  console.log('PHYSICAL_DEVICE_CONNECTED');
 }
 const info=await mp.systemInfo(),physical=info.platform!=='devtools';
 if(process.argv.includes('--remote'))assert.ok(physical,'Remote event did not connect a physical device');
 const login=await api('/api/auth/dev','POST',{privacy_accepted:true});auth='Bearer '+login.token;
 await api('/api/me','PUT',{ai_consent:true,save_chat:true,theme:'light'});
 const issue=await api('/api/issues','POST',{title:'测试：探索新工作方向',background:'虚构成年人测试：保留稳定收入，每周两小时',concerns:['choices']});
 const conversation=(await api('/api/conversations')).find(c=>c.issue_id===issue.id);
 await mp.callWxMethod('setStorageSync','agency.session',login.token);
 await reload();
 const selected=[];
 for(const message of ['我想探索一个新的工作方向，请配一张相关的图片','请换一张不同的图片，继续比较学习与工作']){
  await(await page.$('.chat-input')).input(message);await(await page.$('.send-button')).tap();
  await until(async()=>{const s=await api('/api/conversations/'+conversation.id+'/messages');const items=s.items.filter(m=>m.role==='assistant');if(items.length!==selected.length+1)return false;const id=items.at(-1).payload?.visual_id;if(!id)return false;selected.push(id);return true;},'Selected ID not persisted');
  await until(async()=>{const images=await page.$$('.message-visual.visual-loaded');return images.length===selected.length;},'Cloud image did not load in WeChat');
 }
 assert.equal(new Set(selected).size,2,'Image switching repeated an ID');
 const images=await page.$$('.message-visual');
 for(const image of images)assert.match(await image.attribute('src'),/^https:\/\/ycombbpglsmbvjlrjtgc\.supabase\.co\/storage\/v1\/object\/public\/visual-library\//);
 await mp.screenshot({path:path.join(out,physical?'phone-chat.png':'simulator-chat.png')});
 const callsBefore=(await api('/qa/status')).calls.length;
 await api('/api/me','PUT',{theme:'forest'});await reload();
 await until(async()=>(await page.$$('.message-visual.visual-loaded')).length===2,'Saved images not restored');
 const saved=(await api('/api/conversations/'+conversation.id+'/messages')).items.filter(m=>m.role==='assistant').map(m=>m.payload.visual_id);
 assert.deepEqual(saved,selected);
 assert.equal((await api('/qa/status')).calls.length,callsBefore,'Theme switch called provider');
 assert.deepEqual(errors,[]);
 const report={passed:true,physical,model:info.model,platform:info.platform,width:info.windowWidth,height:info.windowHeight,selected,paid_requests:0,flows:['two distinct reviewed images','exact Supabase image URLs loaded','history restoration','theme change preserves IDs without provider call'],runtime_errors:errors};
 await fs.writeFile(path.join(out,physical?'phone-report.json':'simulator-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
})().catch(async e=>{try{if(mp)await mp.screenshot({path:path.join(out,'failure.png')});}catch{}console.error(e.stack);process.exitCode=1;}).finally(async()=>{if(mp)await mp.disconnect();});
